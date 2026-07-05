const AlertSettings = require('../models/AlertSettings');
const { DEFAULT_SETTINGS } = require('../jobs/alertScheduler');

/**
 * GET /api/alerts/settings
 * Returns the alert engine's current effective settings: whatever has
 * been saved in the database, falling back to the environment-variable
 * defaults for any field that has never been explicitly set. This lets
 * the Alert Settings page always show accurate numbers, even before an
 * Administrator has ever saved a custom value.
 */
async function getSettings(req, res) {
  try {
    const saved = await AlertSettings.findOne().sort({ created_at: -1 });
    res.json({
      cooldown_hours: saved?.cooldown_hours ?? DEFAULT_SETTINGS.cooldown_hours,
      failed_retry_cooldown_hours: saved?.failed_retry_cooldown_hours ?? DEFAULT_SETTINGS.failed_retry_cooldown_hours,
      max_send_attempts: saved?.max_send_attempts ?? DEFAULT_SETTINGS.max_send_attempts,
      is_customized: !!saved,
      updated_at: saved?.updated_at || null,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching alert settings.', error: error.message });
  }
}

/**
 * PUT /api/alerts/settings
 * Allows an Administrator to update the alert engine's cooldown timing
 * from the UI instead of needing to edit Render environment variables
 * and redeploy. A single settings document is maintained (upserted) so
 * there is always exactly one source of truth.
 */
async function updateSettings(req, res) {
  try {
    const { cooldown_hours, failed_retry_cooldown_hours, max_send_attempts } = req.body;

    const updates = {};
    if (cooldown_hours !== undefined && cooldown_hours !== null && cooldown_hours !== '') {
      const v = Number(cooldown_hours);
      if (Number.isNaN(v) || v < 0) return res.status(400).json({ message: 'cooldown_hours must be a non-negative number.' });
      updates.cooldown_hours = v;
    }
    if (failed_retry_cooldown_hours !== undefined && failed_retry_cooldown_hours !== null && failed_retry_cooldown_hours !== '') {
      const v = Number(failed_retry_cooldown_hours);
      if (Number.isNaN(v) || v < 0) return res.status(400).json({ message: 'failed_retry_cooldown_hours must be a non-negative number.' });
      updates.failed_retry_cooldown_hours = v;
    }
    if (max_send_attempts !== undefined && max_send_attempts !== null && max_send_attempts !== '') {
      const v = Number(max_send_attempts);
      if (Number.isNaN(v) || v < 1) return res.status(400).json({ message: 'max_send_attempts must be at least 1.' });
      updates.max_send_attempts = v;
    }
    updates.updated_by = req.user.id;

    let settings = await AlertSettings.findOne().sort({ created_at: -1 });
    if (!settings) {
      settings = await AlertSettings.create(updates);
    } else {
      Object.assign(settings, updates);
      await settings.save();
    }

    res.json({
      cooldown_hours: settings.cooldown_hours ?? DEFAULT_SETTINGS.cooldown_hours,
      failed_retry_cooldown_hours: settings.failed_retry_cooldown_hours ?? DEFAULT_SETTINGS.failed_retry_cooldown_hours,
      max_send_attempts: settings.max_send_attempts ?? DEFAULT_SETTINGS.max_send_attempts,
      is_customized: true,
      updated_at: settings.updated_at,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating alert settings.', error: error.message });
  }
}

module.exports = { getSettings, updateSettings };
