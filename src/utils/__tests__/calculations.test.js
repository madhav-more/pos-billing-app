import {
  round,
  calculateLineTotal,
  calculateSubtotal,
  calculateTax,
  calculateGrandTotal,
  calculateTransactionTotals,
} from '../calculations';

describe('calculations', () => {
  describe('round', () => {
    it('should round to 2 decimal places', () => {
      expect(round(10.123)).toBe(10.12);
      expect(round(10.126)).toBe(10.13);
      expect(round(10.125)).toBe(10.13);
    });

    it('should handle floating point precision issues', () => {
      expect(round(0.1 + 0.2)).toBe(0.3);
    });
  });

  describe('calculateLineTotal', () => {
    it('should calculate line total correctly', () => {
      expect(calculateLineTotal(3, 50, 0)).toBe(150);
      expect(calculateLineTotal(2, 30, 0)).toBe(60);
      expect(calculateLineTotal(1, 70, 0)).toBe(70);
    });

    it('should handle fractional quantities', () => {
      expect(calculateLineTotal(0.5, 100, 0)).toBe(50);
      expect(calculateLineTotal(1.25, 80, 0)).toBe(100);
      expect(calculateLineTotal(2.5, 40, 0)).toBe(100);
    });

    it('should apply per-line discount', () => {
      expect(calculateLineTotal(3, 50, 10)).toBe(140);
      expect(calculateLineTotal(2, 100, 25)).toBe(175);
    });
  });

  describe('calculateSubtotal', () => {
    it('should sum line totals correctly', () => {
      const lines = [
        {lineTotal: 150},
        {lineTotal: 60},
        {lineTotal: 70},
      ];
      expect(calculateSubtotal(lines)).toBe(280);
    });

    it('should handle empty lines', () => {
      expect(calculateSubtotal([])).toBe(0);
    });

    it('should round result', () => {
      const lines = [
        {lineTotal: 10.123},
        {lineTotal: 20.456},
      ];
      expect(calculateSubtotal(lines)).toBe(30.58);
    });
  });

  describe('calculateTax', () => {
    it('should calculate tax percentage correctly', () => {
      expect(calculateTax(100, 10)).toBe(10);
      expect(calculateTax(200, 18)).toBe(36);
      expect(calculateTax(150, 5)).toBe(7.5);
    });

    it('should handle zero tax', () => {
      expect(calculateTax(100, 0)).toBe(0);
    });
  });

  describe('calculateGrandTotal', () => {
    it('should calculate grand total correctly', () => {
      expect(calculateGrandTotal(100, 10, 5, 2)).toBe(113);
    });

    it('should handle zero values', () => {
      expect(calculateGrandTotal(100, 0, 0, 0)).toBe(100);
    });

    it('should apply discount', () => {
      expect(calculateGrandTotal(100, 10, 0, 20)).toBe(90);
    });
  });

  describe('calculateTransactionTotals', () => {
    it('should calculate complete transaction totals', () => {
      const lines = [
        {lineTotal: 150, quantity: 3},
        {lineTotal: 60, quantity: 2},
        {lineTotal: 70, quantity: 1},
      ];

      const result = calculateTransactionTotals(lines, 0, 0, 0);

      expect(result).toEqual({
        subtotal: 280,
        tax: 0,
        discount: 0,
        otherCharges: 0,
        grandTotal: 280,
        itemCount: 3,
        unitCount: 6,
      });
    });

    it('should handle tax and discount', () => {
      const lines = [
        {lineTotal: 100, quantity: 2},
        {lineTotal: 50, quantity: 1},
      ];

      const result = calculateTransactionTotals(lines, 18, 10, 5);

      expect(result.subtotal).toBe(150);
      expect(result.tax).toBe(27);
      expect(result.grandTotal).toBe(172);
    });

    it('should handle fractional quantities in unit count', () => {
      const lines = [
        {lineTotal: 100, quantity: 0.5},
        {lineTotal: 50, quantity: 1.25},
      ];

      const result = calculateTransactionTotals(lines, 0, 0, 0);

      expect(result.unitCount).toBe(1.75);
    });
  });
});
