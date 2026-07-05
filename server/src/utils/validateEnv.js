/**
 * Fail-fast startup validation for required environment variables. If a
 * variable this system genuinely cannot function without is missing,
 * the server previously would either crash later with a confusing,
 * hard-to-trace error (e.g. a cryptic Mongoose connection error, or a
 * JWT signing failure deep inside a request handler), or in some cases
 * silently misbehave (e.g. emails silently never sending because no
 * mail transport was configured at all). Checking everything up front
 * and logging one single, clear message makes the actual problem
 * obvious immediately in the deployment logs, before any request is
 * even accepted.
 */
function validateEnv() {
  const errors = [];
  const warnings = [];

  if (!process.env.MONGODB_URI) {
    errors.push('MONGODB_URI is not set. The application cannot connect to its database without this.');
  }
  if (!process.env.JWT_SECRET) {
    errors.push('JWT_SECRET is not set. Authentication tokens cannot be signed or verified without this.');
  } else if (process.env.JWT_SECRET.length < 16) {
    warnings.push('JWT_SECRET is shorter than 16 characters, which is weak for signing authentication tokens. Consider using a longer, random value.');
  }

  // Email delivery: at least one of the two supported transports (Brevo
  // HTTP API, preferred; or SMTP, fallback) should be configured, or
  // every alert email will silently fail to send.
  const hasBrevo = !!process.env.BREVO_API_KEY;
  const hasSmtp = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
  if (!hasBrevo && !hasSmtp) {
    warnings.push('Neither BREVO_API_KEY nor a full SMTP_HOST/SMTP_USER/SMTP_PASS configuration is set. Alert emails will fail to send until one of these is configured.');
  }

  if (!process.env.ALERT_TRIGGER_KEY) {
    warnings.push('ALERT_TRIGGER_KEY is not set. The POST /api/alerts/run-check endpoint (used by an external cron pinger to keep alerts running on free-tier hosting) will be disabled.');
  }

  if (!process.env.CLIENT_ORIGIN) {
    warnings.push('CLIENT_ORIGIN is not set. CORS will default to allowing all origins, and password-reset email links will not include a valid frontend URL.');
  }

  if (warnings.length > 0) {
    console.warn('\n⚠️  Startup configuration warnings:');
    warnings.forEach((w) => console.warn(`   - ${w}`));
    console.warn('');
  }

  if (errors.length > 0) {
    console.error('\n❌ Cannot start server: missing required configuration.');
    errors.forEach((e) => console.error(`   - ${e}`));
    console.error('\nCopy server/.env.example to server/.env and fill in the missing values, or set these as environment variables on your hosting platform.\n');
    process.exit(1);
  }
}

module.exports = validateEnv;
