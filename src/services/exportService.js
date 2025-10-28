import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system';
import {formatCurrency, formatDateTime, generateReceiptFilename} from '../utils/formatters';
import {ensureExportDirectory, getExportPath} from '../utils/fileUtils';

/**
 * Generate PDF receipt
 */
export async function generatePDF(transaction, lines, shopInfo = {}) {
  try {
    const exportPath = getExportPath();
    await ensureExportDirectory(exportPath);

    const html = generateReceiptHTML(transaction, lines, shopInfo);
    
    const {uri} = await Print.printToFileAsync({html});
    
    const filename = generateReceiptFilename(transaction.id, 'pdf');
    const finalPath = `${exportPath}${filename}`;
    
    await FileSystem.moveAsync({
      from: uri,
      to: finalPath,
    });

    return {success: true, path: finalPath, filename};
  } catch (error) {
    console.error('PDF generation error:', error);
    return {success: false, error: error.message};
  }
}

/**
 * Generate CSV export
 */
export async function generateCSV(transaction, lines) {
  try {
    const exportPath = getExportPath();
    await ensureExportDirectory(exportPath);

    const headers = ['Item Name', 'Quantity', 'Unit Price', 'Discount', 'Line Total'];
    const rows = lines.map(line => [
      line.itemName,
      line.quantity,
      line.unitPrice,
      line.perLineDiscount,
      line.lineTotal,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
      '',
      `Subtotal,${transaction.subtotal}`,
      `Tax,${transaction.tax}`,
      `Discount,${transaction.discount}`,
      `Other Charges,${transaction.otherCharges}`,
      `Grand Total,${transaction.grandTotal}`,
    ].join('\\n');

    const filename = generateReceiptFilename(transaction.id, 'csv');
    const finalPath = `${exportPath}${filename}`;

    await FileSystem.writeAsStringAsync(finalPath, csvContent);

    return {success: true, path: finalPath, filename};
  } catch (error) {
    console.error('CSV generation error:', error);
    return {success: false, error: error.message};
  }
}

/**
 * Generate receipt HTML
 */
function generateReceiptHTML(transaction, lines, shopInfo) {
  const {shopName = 'G.U.R.U Store', ownerName = '', location = ''} = shopInfo;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {
          font-family: 'Courier New', monospace;
          max-width: 400px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          text-align: center;
          border-bottom: 2px solid #000;
          padding-bottom: 10px;
          margin-bottom: 20px;
        }
        .header h1 {
          margin: 0;
          font-size: 24px;
        }
        .header p {
          margin: 5px 0;
          font-size: 12px;
        }
        .info {
          margin-bottom: 20px;
          font-size: 12px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }
        th {
          text-align: left;
          border-bottom: 1px solid #000;
          padding: 5px 0;
          font-size: 12px;
        }
        td {
          padding: 5px 0;
          font-size: 12px;
        }
        .right {
          text-align: right;
        }
        .totals {
          border-top: 2px solid #000;
          padding-top: 10px;
        }
        .totals div {
          display: flex;
          justify-content: space-between;
          margin: 5px 0;
          font-size: 12px;
        }
        .grand-total {
          font-weight: bold;
          font-size: 16px;
          border-top: 1px solid #000;
          padding-top: 10px;
          margin-top: 10px;
        }
        .footer {
          text-align: center;
          margin-top: 30px;
          font-size: 12px;
          border-top: 2px solid #000;
          padding-top: 10px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${shopName}</h1>
        ${ownerName ? `<p>${ownerName}</p>` : ''}
        ${location ? `<p>${location}</p>` : ''}
      </div>

      <div class="info">
        <div>Receipt #: ${transaction.id.substring(0, 8)}</div>
        <div>Date: ${formatDateTime(transaction.date)}</div>
        <div>Items: ${transaction.itemCount} | Units: ${transaction.unitCount}</div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th class="right">Qty</th>
            <th class="right">Price</th>
            <th class="right">Total</th>
          </tr>
        </thead>
        <tbody>
          ${lines
            .map(
              line => `
            <tr>
              <td>${line.itemName}</td>
              <td class="right">${line.quantity}</td>
              <td class="right">${formatCurrency(line.unitPrice)}</td>
              <td class="right">${formatCurrency(line.lineTotal)}</td>
            </tr>
          `,
            )
            .join('')}
        </tbody>
      </table>

      <div class="totals">
        <div>
          <span>Subtotal:</span>
          <span>${formatCurrency(transaction.subtotal)}</span>
        </div>
        ${
          transaction.tax > 0
            ? `
        <div>
          <span>Tax:</span>
          <span>${formatCurrency(transaction.tax)}</span>
        </div>
        `
            : ''
        }
        ${
          transaction.discount > 0
            ? `
        <div>
          <span>Discount:</span>
          <span>-${formatCurrency(transaction.discount)}</span>
        </div>
        `
            : ''
        }
        ${
          transaction.otherCharges > 0
            ? `
        <div>
          <span>Other Charges:</span>
          <span>${formatCurrency(transaction.otherCharges)}</span>
        </div>
        `
            : ''
        }
        <div class="grand-total">
          <span>Grand Total:</span>
          <span>${formatCurrency(transaction.grandTotal)}</span>
        </div>
      </div>

      <div class="footer">
        <p>Thank you for your business!</p>
        <p>Powered by G.U.R.U POS</p>
      </div>
    </body>
    </html>
  `;
}
