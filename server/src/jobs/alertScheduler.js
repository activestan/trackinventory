const cron = require('node-cron');
const InventoryItem = require('../models/InventoryItem');
const Asset = require('../models/Asset');
const Alert = require('../models/Alert');
const User = require('../models/User');
const AlertSettings = require('../models/AlertSettings');
const sendMail = require('../utils/mailer');

// Hard-coded fallback values, used only if neither a database-stored
// AlertSettings document nor the corresponding environment variable is
// present. These mirror the values that were previously hard-coded
// directly into this file before the Alert Settings admin page existed.
const DEFAULT_SETTINGS = {
  cooldown_hours: Number(process.env.ALERT_COOLDOWN_HOURS) || 12,
  failed_retry_cooldown_hours: Number(process.env.ALERT_FAILED_RETRY_COOLDOWN_HOURS) || 6,
  max_send_attempts: Number(process.env.ALERT_MAX_SEND_ATTEMPTS) || 5,
};

// Roles that receive every alert type regardless of its specific subject
// matter, reflecting their oversight responsibility over the whole
// system's inventory and asset operations.
const OVERSIGHT_ROLES = ['Administrator', 'Manager'];

// Roles that additionally receive alerts specific to their day-to-day
// operational responsibility, since they are best placed to act on that
// particular condition immediately (e.g. a Store Officer reordering
// stock, or an Asset Custodian arranging an asset's review/service).
const ROLE_SPECIFIC_RECIPIENTS = {
  'Low-Stock': ['Store Officer'],
  'Asset-Review': ['Asset Custodian'],
  'Asset-Overdue': ['Asset Custodian'],
};

function hoursSince(date) {
  if (!date) return Infinity;
  return (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60);
}

/**
 * Loads the alert engine's currently effective timing settings: whatever
 * an Administrator has saved via the Alert Settings page (database),
 * falling back field-by-field to the environment-variable/hard-coded
 * defaults for anything that has never been explicitly customized. This
 * is re-read on every check so a settings change takes effect on the
 * very next scheduler run, without requiring a server restart.
 */
async function getEffectiveSettings() {
  try {
    const saved = await AlertSettings.findOne().sort({ created_at: -1 });
    return {
      cooldown_hours: saved?.cooldown_hours ?? DEFAULT_SETTINGS.cooldown_hours,
      failed_retry_cooldown_hours: saved?.failed_retry_cooldown_hours ?? DEFAULT_SETTINGS.failed_retry_cooldown_hours,
      max_send_attempts: saved?.max_send_attempts ?? DEFAULT_SETTINGS.max_send_attempts,
    };
  } catch (error) {
    // If settings can't be loaded for any reason (e.g. a transient DB
    // hiccup), fail safe to the hard-coded defaults rather than letting
    // the whole alert check crash.
    console.error('Could not load alert settings, using defaults:', error.message);
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Returns the list of email addresses that should receive a notification
 * for a given alert type: every active Administrator and Manager (who
 * receive all alert types), plus every active user whose role is
 * specifically relevant to that alert type (e.g. Store Officers for
 * Low-Stock alerts, Asset Custodians for Asset-Review alerts). Falls
 * back to ALERT_RECIPIENT_EMAIL if no matching users exist at all, so
 * the system still notifies someone before any accounts are set up.
 */
async function getAlertRecipients(alertType) {
  const relevantRoles = [...OVERSIGHT_ROLES, ...(ROLE_SPECIFIC_RECIPIENTS[alertType] || [])];

  const recipients = await User.find({
    role: { $in: relevantRoles },
    is_active: true,
  }).select('email');

  const emails = [...new Set(recipients.map((u) => u.email).filter(Boolean))];

  if (emails.length === 0 && process.env.ALERT_RECIPIENT_EMAIL) {
    return [process.env.ALERT_RECIPIENT_EMAIL];
  }

  return emails;
}

/**
 * Checks every inventory item for a low-stock condition (quantity_on_hand
 * <= reorder_level) and raises or retries an alert as appropriate.
 */
async function checkLowStock(settings) {
  const lowStockItems = await InventoryItem.find({
    $expr: { $lte: ['$quantity_on_hand', '$reorder_level'] },
  });

  for (const item of lowStockItems) {
    await raiseOrRetryAlert({
      alert_type: 'Low-Stock',
      related_item_id: item._id,
      message: `Low stock alert: "${item.item_name}" (SKU ${item.sku_code}) has ${item.quantity_on_hand} unit(s) remaining, at or below its reorder level of ${item.reorder_level}.`,
      subject: `Low Stock Alert - ${item.item_name}`,
      settings,
    });
  }
}

/**
 * Checks every asset for a review-due condition (warranty expired or
 * review_due_date has passed) and raises or retries an alert as
 * appropriate.
 */
async function checkAssetReviews(settings) {
  const now = new Date();
  const assetsDue = await Asset.find({
    $or: [
      { warranty_expiry: { $lte: now } },
      { review_due_date: { $lte: now } },
    ],
    current_status: { $ne: 'Retired' },
  });

  for (const asset of assetsDue) {
    await raiseOrRetryAlert({
      alert_type: 'Asset-Review',
      related_asset_id: asset._id,
      message: `Asset review alert: "${asset.asset_name}" (Tag ${asset.asset_tag_no}) requires review - its warranty or scheduled review date has passed.`,
      subject: `Asset Review Alert - ${asset.asset_name}`,
      settings,
    });
  }
}

/**
 * Decides whether a notification should be (re)sent for a given
 * condition, based on the most recent Alert record for that exact
 * condition (if any):
 *
 *  - No prior alert at all: this is a brand new condition -> send.
 *  - Most recent alert is Pending or Failed with attempts remaining:
 *    retry the same alert immediately (transient delivery issue).
 *  - Most recent alert is Failed with attempts exhausted: only retry
 *    (with a fresh attempt count) once failed_retry_cooldown_hours has
 *    passed since the last attempt, to avoid hammering a broken email
 *    configuration.
 *  - Most recent alert is Sent: the condition was already reported;
 *    only raise a new reminder alert once cooldown_hours has passed
 *    since it was sent, rather than on every scheduler run.
 */
async function raiseOrRetryAlert({ alert_type, related_item_id, related_asset_id, message, subject, settings }) {
  const filter = { alert_type };
  if (related_item_id) filter.related_item_id = related_item_id;
  if (related_asset_id) filter.related_asset_id = related_asset_id;

  const mostRecent = await Alert.findOne(filter).sort({ date_generated: -1 });

  if (!mostRecent) {
    const alert = await Alert.create({
      alert_type, related_item_id, related_asset_id, message,
      status: 'Pending', date_generated: new Date(),
    });
    await dispatchAlertEmail(alert, message, subject);
    return;
  }

  if (mostRecent.status === 'Sent') {
    if (hoursSince(mostRecent.date_sent) < settings.cooldown_hours) {
      return; // already notified recently for this condition; do not resend yet
    }
    const alert = await Alert.create({
      alert_type, related_item_id, related_asset_id, message,
      status: 'Pending', date_generated: new Date(),
    });
    await dispatchAlertEmail(alert, message, subject);
    return;
  }

  // Status is Pending or Failed at this point.
  if ((mostRecent.send_attempts || 0) >= settings.max_send_attempts) {
    if (hoursSince(mostRecent.updated_at) < settings.failed_retry_cooldown_hours) {
      return; // give the failing configuration a rest before trying again
    }
    mostRecent.send_attempts = 0; // fresh set of attempts after the cooldown
  }

  await dispatchAlertEmail(mostRecent, message, subject);
}

/**
 * Sends the alert email to every recipient relevant to this alert's
 * type and updates the Alert document's status accordingly (Sent or
 * Failed), incrementing the attempt counter on every try so repeated
 * failures are bounded.
 */
async function dispatchAlertEmail(alert, message, subject) {
  alert.send_attempts = (alert.send_attempts || 0) + 1;

  try {
    const recipients = await getAlertRecipients(alert.alert_type);

    if (recipients.length === 0) {
      throw new Error(`No alert recipients configured for alert type "${alert.alert_type}" (no matching role accounts and no ALERT_RECIPIENT_EMAIL fallback).`);
    }

    await sendMail({
      to: recipients.join(', '),
      subject,
      text: message,
    });

    alert.status = 'Sent';
    alert.date_sent = new Date();
    await alert.save();
  } catch (error) {
    console.error(`Failed to send alert email (attempt ${alert.send_attempts}):`, error.message);
    alert.status = 'Failed';
    await alert.save();
  }
}

/**
 * Runs one full alert-checking cycle immediately (used at server startup
 * and can also be triggered manually for testing). Settings are loaded
 * fresh at the start of each run, so an Administrator's change via the
 * Alert Settings page is picked up on the very next run.
 */
async function runAlertCheckNow() {
  const settings = await getEffectiveSettings();
  await checkLowStock(settings);
  await checkAssetReviews(settings);
}

/**
 * Registers the scheduled cron job that repeatedly runs the alert checks
 * at the interval configured in ALERT_CRON_SCHEDULE (default: every 30
 * minutes). This is the "Scheduled Alert Engine" shown in the System
 * Architecture Diagram (Figure 4.6) and Chapter Four of the report.
 */
function startAlertScheduler() {
  const schedule = process.env.ALERT_CRON_SCHEDULE || '*/30 * * * *';

  cron.schedule(schedule, async () => {
    console.log(`[${new Date().toISOString()}] Running scheduled alert check...`);
    try {
      await runAlertCheckNow();
    } catch (error) {
      console.error('Alert scheduler error:', error.message);
    }
  });

  console.log(`Alert scheduler started with schedule: ${schedule}`);
}

module.exports = {
  startAlertScheduler, runAlertCheckNow, getEffectiveSettings, DEFAULT_SETTINGS,
};
