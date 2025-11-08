import { database } from '../db';
import { generatePDF } from './exportService';
import { syncTransactionsToCloud } from './cloudSyncService';
import deltaSyncService from './deltaSyncService';

/**
 * Transaction Processing Service
 * Handles payment completion, receipt generation, and data persistence
 */
class TransactionService {
  /**
   * Process payment and complete transaction
   */
  async processPayment(paymentData) {
    const {
      cartLines,
      totals,
      paymentMode,
      customerName,
      customerMobile,
      taxPercent = 0,
      discount = 0,
      otherCharges = 0,
    } = paymentData;

    try {
      let transactionId;
      let savedLines;
      let shopInfo = {
        shopName: 'G.U.R.U Store',
        ownerName: '',
        location: ''
      };

      // Get shop info for receipt (outside write block)
      try {
        const settingsCollection = database.collections.get('settings');
        const settings = await settingsCollection.query().fetch();
        shopInfo = {
          shopName: settings.find(s => s.key === 'shopName')?.value || 'G.U.R.U Store',
          ownerName: settings.find(s => s.key === 'ownerName')?.value || '',
          location: settings.find(s => s.key === 'location')?.value || ''
        };
      } catch (settingsError) {
        console.warn('Could not load shop settings:', settingsError.message);
      }

      // Create transaction in database
      await database.write(async () => {
        const transactionsCollection = database.collections.get('transactions');
        const transactionLinesCollection = database.collections.get('transaction_lines');
        const itemsCollection = database.collections.get('items');

        // Create transaction
        const transaction = await transactionsCollection.create(txn => {
          txn.customerId = null; // Will be set when customer sync returns server ID
          txn.customerName = customerName || 'Walk-in Customer';
          txn.customerMobile = customerMobile || '';
          txn.date = new Date().toISOString();
          txn.subtotal = totals.subtotal;
          txn.tax = totals.tax;
          txn.discount = totals.discount;
          txn.otherCharges = totals.otherCharges;
          txn.grandTotal = totals.grandTotal;
          txn.itemCount = totals.itemCount;
          txn.unitCount = totals.unitCount;
          txn.paymentType = paymentMode;
          txn.status = 'completed';
          txn.isSynced = false;
          txn.syncedAt = null;
        });

        transactionId = transaction.id;

        // Create transaction lines and deduct inventory
        savedLines = await Promise.all(
          cartLines.map(async line => {
            // Create transaction line
            const txnLine = await transactionLinesCollection.create(tl => {
              tl.transactionId = transaction.id;
              tl.itemId = line.itemId;
              tl.itemName = line.itemName;
              tl.quantity = line.quantity;
              tl.unitPrice = line.unitPrice;
              tl.perLineDiscount = line.perLineDiscount;
              tl.lineTotal = line.lineTotal;
            });

            // Deduct inventory quantity immediately
            try {
              const item = await itemsCollection.find(line.itemId);
              await item.update(i => {
                i.inventoryQty = Math.max(0, i.inventoryQty - line.quantity);
                i.isSynced = false; // Mark for sync
              });
            } catch (error) {
              console.error(`Failed to deduct inventory for item ${line.itemId}:`, error);
            }

            return txnLine;
          }),
        );
      });

      // Generate PDF receipt
      let receiptPath = null;
      try {
        const pdfResult = await generatePDF(
          {
            id: transactionId,
            date: new Date().toISOString(),
            subtotal: totals.subtotal,
            tax: totals.tax,
            discount: totals.discount,
            otherCharges: totals.otherCharges,
            grandTotal: totals.grandTotal,
            itemCount: totals.itemCount,
            unitCount: totals.unitCount,
            paymentType: paymentMode,
            customerName,
            customerMobile,
          },
          savedLines.map(l => ({
            itemName: l.itemName,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            perLineDiscount: l.perLineDiscount,
            lineTotal: l.lineTotal,
          })),
          shopInfo,
        );

        if (pdfResult.success) {
          receiptPath = pdfResult.path;
          
          // Update transaction with receipt path
          await database.write(async () => {
            const transactionsCollection = database.collections.get('transactions');
            const txn = await transactionsCollection.find(transactionId);
            await txn.update(t => {
              t.receiptFilePath = receiptPath;
            });
          });
        }
      } catch (pdfError) {
        console.log('PDF generation failed:', pdfError.message);
      }

      // Sync to cloud in background
      try {
        await deltaSyncService.syncCollection('transactions');
      } catch (syncError) {
        console.log('Cloud sync failed:', syncError.message);
      }

      return {
        success: true,
        transactionId,
        receiptPath,
        message: 'Payment processed successfully',
      };

    } catch (error) {
      console.error('Transaction processing error:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to process payment',
      };
    }
  }

  /**
   * Save transaction for later
   */
  async saveForLater(cartData) {
    const {
      cartLines,
      totals,
      taxPercent = 0,
      discount = 0,
      otherCharges = 0,
    } = cartData;

    try {
      await database.write(async () => {
        const transactionsCollection = database.collections.get('transactions');
        const transactionLinesCollection = database.collections.get('transaction_lines');

        // Create transaction
        const transaction = await transactionsCollection.create(txn => {
          txn.date = new Date().toISOString();
          txn.subtotal = totals.subtotal;
          txn.tax = totals.tax;
          txn.discount = totals.discount;
          txn.otherCharges = totals.otherCharges;
          txn.grandTotal = totals.grandTotal;
          txn.itemCount = totals.itemCount;
          txn.unitCount = totals.unitCount;
          txn.status = 'saved_for_later';
          txn.isSynced = false;
        });

        // Create transaction lines
        await Promise.all(
          cartLines.map(line =>
            transactionLinesCollection.create(txnLine => {
              txnLine.transactionId = transaction.id;
              txnLine.itemId = line.itemId;
              txnLine.itemName = line.itemName;
              txnLine.quantity = line.quantity;
              txnLine.unitPrice = line.unitPrice;
              txnLine.perLineDiscount = line.perLineDiscount;
              txnLine.lineTotal = line.lineTotal;
            }),
          ),
        );
      });

      return {
        success: true,
        message: 'Transaction saved for later',
      };

    } catch (error) {
      console.error('Save for later error:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to save transaction',
      };
    }
  }

  /**
   * Get transaction by ID
   */
  async getTransaction(transactionId) {
    try {
      const transactionsCollection = database.collections.get('transactions');
      const transaction = await transactionsCollection.find(transactionId);
      
      const lines = await transaction.lines.fetch();
      
      return {
        success: true,
        transaction: {
          id: transaction.id,
          date: transaction.date,
          subtotal: transaction.subtotal,
          tax: transaction.tax,
          discount: transaction.discount,
          otherCharges: transaction.otherCharges,
          grandTotal: transaction.grandTotal,
          itemCount: transaction.itemCount,
          unitCount: transaction.unitCount,
          paymentType: transaction.paymentType,
          status: transaction.status,
          customerName: transaction.customerName,
          customerMobile: transaction.customerMobile,
          receiptFilePath: transaction.receiptFilePath,
          lines: lines.map(line => ({
            id: line.id,
            itemName: line.itemName,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            perLineDiscount: line.perLineDiscount,
            lineTotal: line.lineTotal,
          })),
        },
      };
    } catch (error) {
      console.error('Get transaction error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get all transactions
   */
  async getAllTransactions(limit = 100, offset = 0) {
    try {
      const transactionsCollection = database.collections.get('transactions');
      const transactions = await transactionsCollection
        .query()
        .fetch();

      return {
        success: true,
        transactions: transactions.map(txn => ({
          id: txn.id,
          date: txn.date,
          subtotal: txn.subtotal,
          tax: txn.tax,
          discount: txn.discount,
          otherCharges: txn.otherCharges,
          grandTotal: txn.grandTotal,
          itemCount: txn.itemCount,
          unitCount: txn.unitCount,
          paymentType: txn.paymentType,
          status: txn.status,
          customerName: txn.customerName,
          customerMobile: txn.customerMobile,
          receiptFilePath: txn.receiptFilePath,
          isSynced: txn.isSynced,
          createdAt: txn.createdAt,
          updatedAt: txn.updatedAt,
        })),
      };
    } catch (error) {
      console.error('Get all transactions error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get today's transactions
   */
  async getTodaysTransactions() {
    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

      const transactionsCollection = database.collections.get('transactions');
      const transactions = await transactionsCollection
        .query()
        .fetch();

      const todaysTransactions = transactions.filter(txn => {
        const txnDate = new Date(txn.date);
        return txnDate >= startOfDay && txnDate < endOfDay;
      });

      return {
        success: true,
        transactions: todaysTransactions.map(txn => ({
          id: txn.id,
          date: txn.date,
          subtotal: txn.subtotal,
          tax: txn.tax,
          discount: txn.discount,
          otherCharges: txn.otherCharges,
          grandTotal: txn.grandTotal,
          itemCount: txn.itemCount,
          unitCount: txn.unitCount,
          paymentType: txn.paymentType,
          status: txn.status,
          customerName: txn.customerName,
          customerMobile: txn.customerMobile,
          receiptFilePath: txn.receiptFilePath,
          isSynced: txn.isSynced,
          createdAt: txn.createdAt,
          updatedAt: txn.updatedAt,
        })),
      };
    } catch (error) {
      console.error('Get today\'s transactions error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

// Export singleton instance
export default new TransactionService();
