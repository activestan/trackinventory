const mongoose = require('mongoose');

/**
 * A singleton settings document controlling the alert engine's timing
 * behaviour. Historically these values (ALERT_COOLDOWN_HOURS etc.) were
 * only configurable via Render environment variables, which requires a
 * redeploy to change. Storing them in the database instead lets an
 * Administrator adjust them live from the Alert Settings page.
 *
 * Only one document of this type is ever expected to exist; see
 * getEffectiveSettings() in jobs/alertScheduler.js for how it is loaded
 * (falling back to environment variables, then hard-coded defaults, if
 * no document has been created yet).
 */
const AlertSettingsSchema = new mongoose.Schema(
  {
    cooldown_hours: { type: Number, default: null, min: 0 },
    failed_retry_cooldown_hours: { type: Number, default: null, min: 0 },
    max_send_attempts: { type: Number, default: null, min: 1 },
    updated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

module.exports = mongoose.model('AlertSettings', AlertSettingsSchema);
