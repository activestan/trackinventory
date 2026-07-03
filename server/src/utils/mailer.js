/**
 * Sends transactional emails via the Brevo HTTP API (https://api.brevo.com)
 * rather than raw SMTP. This is a deliberate choice: as of September 26,
 * 2025, Render's free web service tier blocks all outbound traffic on the
 * traditional SMTP ports (25, 465, 587), which silently breaks any
 * Nodemailer/SMTP-based email sending when deployed there. Brevo's
 * transactional email API communicates over standard HTTPS (port 443),
 * which is not affected by that restriction, so this approach works
 * reliably on Render's free tier without requiring a paid plan.
 *
 * If BREVO_API_KEY is not configured, this module transparently falls
 * back to SMTP (via Nodemailer) so that local development or other
 * hosting providers without the SMTP restriction can still use plain
 * SMTP credentials if preferred.
 */

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const REQUEST_TIMEOUT_MS = 15000;

async function sendViaBrevoApi({ to, subject, text, html }) {
  const apiKey = process.env.BREVO_API_KEY;
  const fromEmail = process.env.ALERT_FROM_EMAIL || process.env.SMTP_USER;
  const fromName = process.env.ALERT_FROM_NAME || 'Inventory & Asset Tracking System';

  // Brevo expects an array of {email, name} recipient objects; accept a
  // comma-separated string of addresses (as used elsewhere in this app).
  const recipients = to
    .split(',')
    .map((email) => email.trim())
    .filter(Boolean)
    .map((email) => ({ email }));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        sender: { email: fromEmail, name: fromName },
        to: recipients,
        subject,
        textContent: text,
        htmlContent: html || `<p>${text}</p>`,
      }),
      signal: controller.signal,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(`Brevo API error (${response.status}): ${data.message || JSON.stringify(data)}`);
    }

    return { messageId: data.messageId, accepted: recipients.map((r) => r.email) };
  } finally {
    clearTimeout(timeout);
  }
}

async function sendViaSmtp({ to, subject, text, html }) {
  // Lazily required so that environments using only the Brevo API path
  // never need nodemailer's SMTP transport to actually connect anywhere.
  const nodemailer = require('nodemailer');

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });

  const sendPromise = transporter.sendMail({
    from: process.env.ALERT_FROM_EMAIL || process.env.SMTP_USER,
    to,
    subject,
    text,
    html: html || `<p>${text}</p>`,
  });

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Email send timed out after 20 seconds.')), 20000);
  });

  return Promise.race([sendPromise, timeoutPromise]);
}

/**
 * Sends an email notification. Used by the scheduled alert engine to
 * dispatch low-stock and asset-related alert emails.
 * @param {{to: string, subject: string, text: string, html?: string}} options
 */
async function sendMail(options) {
  if (process.env.BREVO_API_KEY) {
    return sendViaBrevoApi(options);
  }
  return sendViaSmtp(options);
}

module.exports = sendMail;
