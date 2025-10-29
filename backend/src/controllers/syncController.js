import Item from '../models/Item.js';
import Customer from '../models/Customer.js';
import Transaction from '../models/Transaction.js';

export const pullChanges = async (req, res) => {
  const { since } = req.body;
  const userId = req.user.userId;

  try {
    const sinceDate = since ? new Date(since) : new Date(0);
    
    const items = await Item.find({
      user_id: userId,
      updatedAt: { $gt: sinceDate }
    }).sort({ updatedAt: 1 });

    const customers = await Customer.find({
      user_id: userId,
      updatedAt: { $gt: sinceDate }
    }).sort({ updatedAt: 1 });

    const transactions = await Transaction.find({
      user_id: userId,
      updatedAt: { $gt: sinceDate }
    }).sort({ updatedAt: 1 });

    res.json({
      items,
      customers,
      transactions,
      server_timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Pull changes error:', error);
    res.status(500).json({ error: 'Failed to pull changes' });
  }
};

export const pushChanges = async (req, res) => {
  const { items, customers, transactions } = req.body;
  const userId = req.user.userId;

  try {
    const results = {
      items: { synced: [], conflicts: [] },
      customers: { synced: [], conflicts: [] },
      transactions: { synced: [], conflicts: [] }
    };

    // Push items
    if (items && Array.isArray(items)) {
      for (const item of items) {
        const existing = await Item.findById(item.id);
        const itemUpdatedAt = item.updated_at ? new Date(item.updated_at) : new Date();

        if (existing && existing.updatedAt > itemUpdatedAt) {
          results.items.conflicts.push(existing);
        } else {
          const upserted = await Item.findByIdAndUpdate(
            item.id,
            {
              _id: item.id,
              user_id: userId,
              ...item,
              updatedAt: itemUpdatedAt
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          );
          results.items.synced.push(upserted);
        }
      }
    }

    // Push customers
    if (customers && Array.isArray(customers)) {
      for (const customer of customers) {
        const existing = await Customer.findById(customer.id);
        const customerUpdatedAt = customer.updated_at ? new Date(customer.updated_at) : new Date();

        if (existing && existing.updatedAt > customerUpdatedAt) {
          results.customers.conflicts.push(existing);
        } else {
          const upserted = await Customer.findByIdAndUpdate(
            customer.id,
            {
              _id: customer.id,
              user_id: userId,
              ...customer,
              updatedAt: customerUpdatedAt
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          );
          results.customers.synced.push(upserted);
        }
      }
    }

    // Push transactions (append-only)
    if (transactions && Array.isArray(transactions)) {
      for (const tx of transactions) {
        const existing = await Transaction.findById(tx.id);
        if (existing) {
          results.transactions.conflicts.push({ id: tx.id, error: 'Already exists' });
        } else {
          const newTx = await Transaction.create({
            _id: tx.id,
            user_id: userId,
            ...tx
          });
          results.transactions.synced.push(newTx);
        }
      }
    }

    res.json({
      ...results,
      server_timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Push changes error:', error);
    res.status(500).json({ error: 'Failed to push changes', details: error.message });
  }
};
