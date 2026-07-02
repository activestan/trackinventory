const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
}

/**
 * Sends an email notification. Used by the scheduled alert engine to
 * dispatch low-stock and asset-related alert emails.
 * @param {{to: string, subject: string, text: string, html?: string}} options
 */
async function sendMail({ to, subject, text, html }) {
  const mailer = getTransporter();

  const info = await mailer.sendMail({
    from: process.env.ALERT_FROM_EMAIL || process.env.SMTP_USER,
    to,
    subject,
    text,
    html: html || `<p>${text}</p>`,
  });

  return info;
}

module.exports = sendMail;
