import Transaction from '../models/Transaction.js';
import Item from '../models/Item.js';
import mongoose from 'mongoose';

export const createTransactionsBatch = async (req, res) => {
  const { transactions } = req.body;
  const userId = req.user.userId;

  if (!Array.isArray(transactions) || transactions.length === 0) {
    return res.status(400).json({ error: 'Transactions array is required' });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const createdTransactions = [];
    const warnings = [];

    for (const transaction of transactions) {
      const { id, customer_id, date, subtotal, tax, discount, other_charges, grand_total,
              item_count, unit_count, payment_type, status, receipt_path, lines } = transaction;

      if (!id || !lines || !Array.isArray(lines) || lines.length === 0) {
        warnings.push({ transaction, error: 'Missing required fields: id or lines' });
        continue;
      }

      // Check if transaction already exists (idempotency)
      const existingTx = await Transaction.findById(id).session(session);
      if (existingTx) {
        warnings.push({ transaction: id, error: 'Transaction already exists (skipped)' });
        continue;
      }

      const inventoryWarnings = [];

      // Update inventory for each line
      for (const line of lines) {
        if (line.item_id) {
          const item = await Item.findById(line.item_id).session(session);
          if (item) {
            const newQty = item.inventory_qty - line.quantity;
            item.inventory_qty = newQty;
            await item.save({ session });

            if (newQty < 0) {
              inventoryWarnings.push({
                item_id: line.item_id,
                item_name: line.item_name,
                new_inventory_qty: newQty,
                warning: 'Inventory is now negative'
              });
            }
          }
        }
      }

      // Create transaction
      const newTransaction = await Transaction.create([{
        _id: id,
        user_id: userId,
        customer_id,
        date: date || new Date(),
        subtotal: subtotal || 0,
        tax: tax || 0,
        discount: discount || 0,
        other_charges: other_charges || 0,
        grand_total: grand_total || 0,
        item_count: item_count || 0,
        unit_count: unit_count || 0,
        payment_type: payment_type || 'cash',
        status: status || 'completed',
        receipt_path,
        lines: lines || []
      }], { session });

      createdTransactions.push({
        ...newTransaction[0].toObject(),
        inventory_warnings: inventoryWarnings.length > 0 ? inventoryWarnings : undefined
      });
    }

    await session.commitTransaction();
    res.json({ transactions: createdTransactions, warnings });
  } catch (error) {
    await session.abortTransaction();
    console.error('Batch create transactions error:', error);
    res.status(500).json({ error: 'Failed to create transactions', details: error.message });
  } finally {
    session.endSession();
  }
};

export const getTransactions = async (req, res) => {
  const { from, to, customer_id, payment_type, status, since } = req.query;
  const userId = req.user.userId;

  try {
    const query = { user_id: userId };

    if (from) query.date = { $gte: new Date(from) };
    if (to) query.date = { ...query.date, $lte: new Date(to) };
    if (customer_id) query.customer_id = customer_id;
    if (payment_type) query.payment_type = payment_type;
    if (status) query.status = status;
    if (since) query.updatedAt = { $gt: new Date(since) };

    const transactions = await Transaction.find(query)
      .populate('customer_id', 'name phone')
      .sort({ date: -1 })
      .limit(1000);

    res.json({ transactions });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
};
