const cron = require('node-cron');
const InventoryItem = require('../models/InventoryItem');
const Asset = require('../models/Asset');
const Alert = require('../models/Alert');
const User = require('../models/User');
const sendMail = require('../utils/mailer');

// An alert is only considered "resolved" (and eligible for a new alert to
// be raised) once it has been successfully Sent. A Failed or still-Pending
// alert for the same condition is retried instead of duplicated.
const UNRESOLVED_STATUSES = ['Pending', 'Failed'];

// A Failed alert is retried at most this many times before being left
// alone (to avoid retrying forever against a permanently broken mail
// configuration). Each unresolved alert counts every scheduler run as one
// attempt via the send_attempts counter.
const MAX_SEND_ATTEMPTS = 5;

/**
 * Returns the list of email addresses that should receive alert
 * notifications: every active Administrator and Manager. Falls back to
 * ALERT_RECIPIENT_EMAIL (if configured) so the system still works even
 * before any Administrator/Manager accounts exist.
 */
async function getAlertRecipients() {
  const recipients = await User.find({
    role: { $in: ['Administrator', 'Manager'] },
    is_active: true,
  }).select('email');

  const emails = recipients.map((u) => u.email).filter(Boolean);

  if (emails.length === 0 && process.env.ALERT_RECIPIENT_EMAIL) {
    return [process.env.ALERT_RECIPIENT_EMAIL];
  }

  return emails;
}

/**
 * Checks every inventory item for a low-stock condition (quantity_on_hand
 * <= reorder_level). For each qualifying item without an already-resolved
 * (Sent) alert, an Alert document is created or reused and an email is
 * (re)attempted.
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
 * review_due_date has passed). For each qualifying asset without an
 * already-resolved (Sent) alert, an Alert document is created or reused
 * and an email is (re)attempted.
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
 * Finds an existing unresolved (Pending or Failed) alert for the given
 * condition and retries it, or creates a brand new alert if none exists.
 * This prevents both (a) duplicate alerts being created every scheduler
 * run for the same unresolved condition, and (b) a Failed/stuck-Pending
 * alert being silently abandoned forever.
 */
async function raiseOrRetryAlert({ alert_type, related_item_id, related_asset_id, message, subject }) {
  const filter = {
    alert_type,
    status: { $in: UNRESOLVED_STATUSES },
  };
  if (related_item_id) filter.related_item_id = related_item_id;
  if (related_asset_id) filter.related_asset_id = related_asset_id;

  let alert = await Alert.findOne(filter);

  if (alert) {
    if ((alert.send_attempts || 0) >= MAX_SEND_ATTEMPTS) {
      return; // give up retrying this specific alert until it's manually reviewed
    }
  } else {
    alert = await Alert.create({
      alert_type,
      related_item_id,
      related_asset_id,
      message,
      status: 'Pending',
      date_generated: new Date(),
    });
  }

  await dispatchAlertEmail(alert, message, subject);
}

/**
 * Sends the alert email to every configured recipient and updates the
 * Alert document's status accordingly (Sent or Failed), incrementing the
 * attempt counter on every try so repeated failures are bounded.
 */
async function dispatchAlertEmail(alert, message, subject) {
  alert.send_attempts = (alert.send_attempts || 0) + 1;

  try {
    const recipients = await getAlertRecipients();

    if (recipients.length === 0) {
      throw new Error('No alert recipients configured (no Administrator/Manager accounts and no ALERT_RECIPIENT_EMAIL fallback).');
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
