const nodemailer = require('nodemailer');

let transporter = null;

// Prevents a stalled SMTP connection/handshake from hanging the request
// that triggered it indefinitely. Without explicit timeouts, Nodemailer's
// underlying socket can wait far longer than is acceptable for an HTTP
// request/response cycle.
const CONNECTION_TIMEOUT_MS = 10000;
const GREETING_TIMEOUT_MS = 10000;
const SOCKET_TIMEOUT_MS = 15000;

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
    connectionTimeout: CONNECTION_TIMEOUT_MS,
    greetingTimeout: GREETING_TIMEOUT_MS,
    socketTimeout: SOCKET_TIMEOUT_MS,
  });

  return transporter;
}

/**
 * Sends an email notification. Used by the scheduled alert engine to
 * dispatch low-stock and asset-related alert emails. Wrapped in an
 * explicit timeout as a second line of defense in case the transport-level
 * timeouts above do not trigger for some reason (e.g. a hung DNS lookup).
 * @param {{to: string, subject: string, text: string, html?: string}} options
 */
async function sendMail({ to, subject, text, html }) {
  const mailer = getTransporter();

  const sendPromise = mailer.sendMail({
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

module.exports = sendMail;
