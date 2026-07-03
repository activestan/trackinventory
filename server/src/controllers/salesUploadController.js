const { parse } = require('csv-parse/sync');
const XLSX = require('xlsx');
const InventoryItem = require('../models/InventoryItem');
const StockTransaction = require('../models/StockTransaction');
const SalesUpload = require('../models/SalesUpload');

/**
 * Normalizes a variety of plausible column header spellings to the two
 * fields this feature actually needs, so that managers do not need to
 * follow an exact, fragile template when preparing their sales file.
 */
const SKU_HEADER_ALIASES = ['sku', 'sku_code', 'skucode', 'item_sku', 'code'];
const QUANTITY_HEADER_ALIASES = ['quantity', 'qty', 'quantity_sold', 'qty_sold', 'units', 'units_sold'];

function findHeaderKey(row, aliases) {
  const keys = Object.keys(row);
  const normalize = (s) => s.trim().toLowerCase().replace(/[\s-]+/g, '_');
  const match = keys.find((k) => aliases.includes(normalize(k)));
  return match || null;
}

/**
 * Parses the uploaded file's buffer into an array of plain row objects
 * (one per data row, keyed by column header), supporting both CSV and
 * Excel (.xlsx/.xls) files so that managers and store officers can
 * upload whichever format their sales records are already kept in,
 * without needing to manually convert Excel to CSV first.
 */
function parseUploadedFile(file) {
  const isExcel = /\.(xlsx|xls)$/i.test(file.originalname);

  if (isExcel) {
    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new Error('The Excel file does not contain any sheets.');
    }
    const worksheet = workbook.Sheets[firstSheetName];
    // defval ensures cells left blank in a row still appear as empty
    // strings rather than being omitted from the resulting row object,
    // keeping row objects consistent for the validation logic below.
    return XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false });
  }

  return parse(file.buffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
}

/**
 * POST /api/sales-uploads
 * Accepts a CSV or Excel (.xlsx/.xls) file (multipart/form-data, field
 * name "file") containing a day's sales, with at minimum a SKU column
 * and a quantity column. Every valid row is recorded as a Stock-Out
 * transaction against the matching inventory item, exactly as if a
 * Store Officer had manually recorded that sale, automatically reducing
 * quantity_on_hand and feeding directly into the same low-stock alert
 * logic. Restricted to Administrator, Manager and Store Officer roles.
 */
async function uploadSalesFile(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file was uploaded. Please attach a CSV or Excel file under the "file" field.' });
    }

    let rows;
    try {
      rows = parseUploadedFile(req.file);
    } catch (parseError) {
      return res.status(400).json({ message: 'The uploaded file could not be parsed. Please ensure it is a valid CSV or Excel file.', error: parseError.message });
    }

    if (rows.length === 0) {
      return res.status(400).json({ message: 'The uploaded file contains no data rows.' });
    }

    const rowResults = [];
    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      const rowNumber = i + 2; // +1 for zero-index, +1 for the header row

      const skuKey = findHeaderKey(row, SKU_HEADER_ALIASES);
      const qtyKey = findHeaderKey(row, QUANTITY_HEADER_ALIASES);

      const skuCode = skuKey ? String(row[skuKey]).trim() : '';
      const quantityRaw = qtyKey ? row[qtyKey] : undefined;
      const quantity = Number(quantityRaw);

      if (!skuCode) {
        rowResults.push({ row_number: rowNumber, sku_code: skuCode || '(missing)', quantity: null, status: 'Failed', message: 'Missing or unrecognized SKU column for this row.' });
        failureCount += 1;
        continue;
      }

      if (!quantityRaw || Number.isNaN(quantity) || quantity <= 0) {
        rowResults.push({ row_number: rowNumber, sku_code: skuCode, quantity: null, status: 'Failed', message: 'Missing, non-numeric, or non-positive quantity for this row.' });
        failureCount += 1;
        continue;
      }

      const item = await InventoryItem.findOne({ sku_code: skuCode });
      if (!item) {
        rowResults.push({ row_number: rowNumber, sku_code: skuCode, quantity, status: 'Failed', message: `No inventory item found with SKU code "${skuCode}".` });
        failureCount += 1;
        continue;
      }

      if (quantity > item.quantity_on_hand) {
        rowResults.push({
          row_number: rowNumber,
          sku_code: skuCode,
          quantity,
          status: 'Failed',
          message: `Cannot record sale of ${quantity} unit(s); only ${item.quantity_on_hand} unit(s) currently in stock for "${item.item_name}".`,
          item_id: item._id,
        });
        failureCount += 1;
        continue;
      }

      item.quantity_on_hand -= quantity;
      await item.save();

      const transaction = await StockTransaction.create({
        item_id: item._id,
        user_id: req.user.id,
        transaction_type: 'Stock-Out',
        quantity,
        remarks: `Recorded via daily sales upload (${req.file.originalname}).`,
      });

      rowResults.push({
        row_number: rowNumber,
        sku_code: skuCode,
        quantity,
        status: 'Success',
        message: `Recorded sale of ${quantity} unit(s) of "${item.item_name}".`,
        item_id: item._id,
        transaction_id: transaction._id,
      });
      successCount += 1;
    }

    const upload = await SalesUpload.create({
      uploaded_by: req.user.id,
      original_filename: req.file.originalname,
      total_rows: rows.length,
      success_count: successCount,
      failure_count: failureCount,
      row_results: rowResults,
    });

    res.status(201).json(upload);
  } catch (error) {
    res.status(500).json({ message: 'Error processing sales upload.', error: error.message });
  }
}

// GET /api/sales-uploads - list past upload batches (most recent first)
async function listSalesUploads(req, res) {
  try {
    const uploads = await SalesUpload.find()
      .populate('uploaded_by', 'full_name')
      .select('-row_results')
      .sort({ created_at: -1 });
    res.json(uploads);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching sales upload history.', error: error.message });
  }
}

// GET /api/sales-uploads/:id - full detail (including per-row results) of one upload batch
async function getSalesUpload(req, res) {
  try {
    const upload = await SalesUpload.findById(req.params.id)
      .populate('uploaded_by', 'full_name')
      .populate('row_results.item_id', 'item_name sku_code');
    if (!upload) return res.status(404).json({ message: 'Sales upload not found.' });
    res.json(upload);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching sales upload.', error: error.message });
  }
}

module.exports = { uploadSalesFile, listSalesUploads, getSalesUpload };
