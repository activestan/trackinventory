const cron = require('node-cron');
const InventoryItem = require('../models/InventoryItem');
const Asset = require('../models/Asset');
const Alert = require('../models/Alert');
const User = require('../models/User');
const sendMail = require('../utils/mailer');

// A Failed alert is retried immediately on every check while its attempt
// count remains below this limit, to recover quickly from a transient
// delivery problem (e.g. a brief outage of the email provider).
const MAX_SEND_ATTEMPTS = 5;

// Once an alert for a given condition has been successfully Sent, no new
// alert is raised for the same condition until this many hours have
// passed, even if the underlying condition (e.g. low stock) persists.
// Without this, a condition that remains unresolved between scheduler
// runs would otherwise generate and send a brand new alert on every
// single run - including runs triggered every few minutes by an
// external uptime/cron pinger - flooding recipients with duplicate
// emails for a problem they have already been told about. After the
// cooldown elapses, a fresh alert is sent as a reminder that the
// condition is still unresolved.
const ALERT_COOLDOWN_HOURS = Number(process.env.ALERT_COOLDOWN_HOURS) || 12;

// If a Failed alert has exhausted MAX_SEND_ATTEMPTS, it is left alone
// (not retried on every run) until this many hours have passed since its
// last attempt, at which point it is given a fresh set of attempts. This
// allows the system to self-heal after a prolonged outage of the email
// provider without retrying uselessly every few minutes in the meantime.
const FAILED_RETRY_COOLDOWN_HOURS = Number(process.env.ALERT_FAILED_RETRY_COOLDOWN_HOURS) || 6;

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
async function checkLowStock() {
  const lowStockItems = await InventoryItem.find({
    $expr: { $lte: ['$quantity_on_hand', '$reorder_level'] },
  });

  for (const item of lowStockItems) {
    await raiseOrRetryAlert({
      alert_type: 'Low-Stock',
      related_item_id: item._id,
      message: `Low stock alert: "${item.item_name}" (SKU ${item.sku_code}) has ${item.quantity_on_hand} unit(s) remaining, at or below its reorder level of ${item.reorder_level}.`,
      subject: `Low Stock Alert - ${item.item_name}`,
    });
  }
}

/**
 * Checks every asset for a review-due condition (warranty expired or
 * review_due_date has passed) and raises or retries an alert as
 * appropriate.
 */
async function checkAssetReviews() {
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
 *    (with a fresh attempt count) once FAILED_RETRY_COOLDOWN_HOURS has
 *    passed since the last attempt, to avoid hammering a broken email
 *    configuration.
 *  - Most recent alert is Sent: the condition was already reported;
 *    only raise a new reminder alert once ALERT_COOLDOWN_HOURS has
 *    passed since it was sent, rather than on every scheduler run.
 */
async function raiseOrRetryAlert({ alert_type, related_item_id, related_asset_id, message, subject }) {
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
    if (hoursSince(mostRecent.date_sent) < ALERT_COOLDOWN_HOURS) {
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
  if ((mostRecent.send_attempts || 0) >= MAX_SEND_ATTEMPTS) {
    if (hoursSince(mostRecent.updated_at) < FAILED_RETRY_COOLDOWN_HOURS) {
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
 * and can also be triggered manually for testing).
 */
async function runAlertCheckNow() {
  await checkLowStock();
  await checkAssetReviews();
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

module.exports = { startAlertScheduler, runAlertCheckNow };
