const cron = require('node-cron');
const InventoryItem = require('../models/InventoryItem');
const Asset = require('../models/Asset');
const Alert = require('../models/Alert');
const sendMail = require('../utils/mailer');

/**
 * Checks every inventory item for a low-stock condition (quantity_on_hand
 * <= reorder_level). For each qualifying item that does not already have
 * a pending alert, an Alert document is created and an email is sent.
 */
async function checkLowStock() {
  const lowStockItems = await InventoryItem.find({
    $expr: { $lte: ['$quantity_on_hand', '$reorder_level'] },
  });

  for (const item of lowStockItems) {
    const existing = await Alert.findOne({
      related_item_id: item._id,
      alert_type: 'Low-Stock',
      status: 'Pending',
    });
    if (existing) continue; // avoid duplicate alerts for the same unresolved condition

    const message = `Low stock alert: "${item.item_name}" (SKU ${item.sku_code}) has ${item.quantity_on_hand} unit(s) remaining, at or below its reorder level of ${item.reorder_level}.`;

    const alert = await Alert.create({
      alert_type: 'Low-Stock',
      related_item_id: item._id,
      message,
      status: 'Pending',
      date_generated: new Date(),
    });

    await dispatchAlertEmail(alert, message, `Low Stock Alert - ${item.item_name}`);
  }
}

/**
 * Checks every asset for a review-due condition (warranty expired or
 * review_due_date has passed). For each qualifying asset without an
 * existing pending alert, an Alert document is created and an email is
 * sent to the designated recipient.
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
    const existing = await Alert.findOne({
      related_asset_id: asset._id,
      alert_type: 'Asset-Review',
      status: 'Pending',
    });
    if (existing) continue;

    const message = `Asset review alert: "${asset.asset_name}" (Tag ${asset.asset_tag_no}) requires review - its warranty or scheduled review date has passed.`;

    const alert = await Alert.create({
      alert_type: 'Asset-Review',
      related_asset_id: asset._id,
      message,
      status: 'Pending',
      date_generated: new Date(),
    });

    await dispatchAlertEmail(alert, message, `Asset Review Alert - ${asset.asset_name}`);
  }
}

/**
 * Sends the alert email and updates the Alert document's status
 * accordingly (Sent or Failed).
 */
async function dispatchAlertEmail(alert, message, subject) {
  try {
    await sendMail({
      to: process.env.ALERT_RECIPIENT_EMAIL,
      subject,
      text: message,
    });
    alert.status = 'Sent';
    alert.date_sent = new Date();
    await alert.save();
  } catch (error) {
    console.error('Failed to send alert email:', error.message);
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
