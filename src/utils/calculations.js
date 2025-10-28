/**
 * Round to 2 decimal places with proper decimal handling
 */
export function round(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Calculate line total: (quantity * unitPrice) - perLineDiscount
 */
export function calculateLineTotal(quantity, unitPrice, perLineDiscount = 0) {
  const rawTotal = quantity * unitPrice - perLineDiscount;
  return round(rawTotal);
}

/**
 * Calculate subtotal from array of line totals
 */
export function calculateSubtotal(lines) {
  const sum = lines.reduce((acc, line) => acc + line.lineTotal, 0);
  return round(sum);
}

/**
 * Calculate tax amount from subtotal and tax percentage
 */
export function calculateTax(subtotal, taxPercent) {
  const taxAmount = (subtotal * taxPercent) / 100;
  return round(taxAmount);
}

/**
 * Calculate grand total
 */
export function calculateGrandTotal(subtotal, tax, otherCharges = 0, discount = 0) {
  const total = subtotal + tax + otherCharges - discount;
  return round(total);
}

/**
 * Calculate full transaction totals from lines
 */
export function calculateTransactionTotals(lines, taxPercent = 0, discount = 0, otherCharges = 0) {
  const subtotal = calculateSubtotal(lines);
  const tax = calculateTax(subtotal, taxPercent);
  const grandTotal = calculateGrandTotal(subtotal, tax, otherCharges, discount);

  const itemCount = lines.length;
  const unitCount = round(lines.reduce((acc, line) => acc + line.quantity, 0));

  return {
    subtotal,
    tax,
    discount,
    otherCharges,
    grandTotal,
    itemCount,
    unitCount,
  };
}
