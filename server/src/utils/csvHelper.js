/**
 * Minimal, dependency-free CSV serialization helper shared by the
 * various "Export as CSV" report endpoints. Handles the standard CSV
 * escaping rules (wrap in quotes if the value contains a comma, quote,
 * or newline; double up any internal quotes).
 */
function escapeCsvValue(value) {
  const str = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function toCsv(headerRow, dataRows) {
  const lines = [headerRow.map(escapeCsvValue).join(',')];
  for (const row of dataRows) {
    lines.push(row.map(escapeCsvValue).join(','));
  }
  return lines.join('\n');
}

function sendCsv(res, filename, headerRow, dataRows) {
  const csv = toCsv(headerRow, dataRows);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}

module.exports = { escapeCsvValue, toCsv, sendCsv };
