import {format} from 'date-fns';

/**
 * Format currency with symbol
 */
export function formatCurrency(amount, symbol = '₹') {
  return `${symbol} ${amount.toFixed(2)}`;
}

/**
 * Format date to readable string
 */
export function formatDate(date, pattern = 'dd/MM/yyyy') {
  return format(new Date(date), pattern);
}

/**
 * Format date and time
 */
export function formatDateTime(date) {
  return format(new Date(date), 'dd/MM/yyyy hh:mm a');
}

/**
 * Generate receipt filename
 */
export function generateReceiptFilename(transactionId, extension = 'pdf') {
  const timestamp = format(new Date(), 'yyyyMMdd-HHmmss');
  return `receipt-${transactionId}-${timestamp}.${extension}`;
}

/**
 * Format quantity with unit
 */
export function formatQuantity(quantity, unit) {
  return `${quantity} ${unit}`;
}
