import Item from '../models/Item.js';
import Customer from '../models/Customer.js';
import Transaction from '../models/Transaction.js';
import { resolveCompanyCode } from '../utils/companyScope.js';

export const pushChanges = async (req, res) => {
  const { items, customers, transactions, user_id } = req.body;
  const userId = req.user.userId;

  if (userId !== user_id) {
    return res.status(403).json({ error: 'User mismatch' });
  }

  try {
    const companyCode = await resolveCompanyCode(req);
    if (!companyCode) {
      return res.status(403).json({ error: 'Company scope required' });
    }

    const results = {
      items: { synced: [], conflicts: [] },
      customers: { synced: [], conflicts: [] },
      transactions: { synced: [], conflicts: [] }
    };

    if (items && Array.isArray(items)) {
      for (const item of items) {
        try {
          if (item.idempotency_key) {
            const existingByIdempotency = await Item.findOne({
              idempotency_key: item.idempotency_key,
              company_code: companyCode
            });

            if (existingByIdempotency) {
              results.items.synced.push({
                local_id: item.id,
                cloud_id: existingByIdempotency._id.toString(),
              });
              continue;
            }
          }

          let existingItem = await Item.findOne({
            _id: item.id,
            company_code: companyCode
          });

          const itemUpdatedAt = new Date(item.updated_at || item.updatedAt || Date.now());
          const payload = { ...item };
          delete payload.id;
          delete payload._id;

          if (existingItem) {
            if (itemUpdatedAt > existingItem.updatedAt) {
              await Item.findByIdAndUpdate(existingItem._id, {
                ...payload,
                user_id: userId,
                company_code: companyCode,
                updatedAt: itemUpdatedAt
              });
            }
            existingItem = await Item.findById(existingItem._id);
          } else {
            const newItem = new Item({
              _id: item.id,
              ...payload,
              user_id: userId,
              company_code: companyCode,
              updatedAt: itemUpdatedAt
            });
            existingItem = await newItem.save();
          }

          results.items.synced.push({
            local_id: item.id,
            cloud_id: existingItem._id.toString(),
            voucher_number: existingItem.voucher_number,
          });
        } catch (itemError) {
          console.error('Item sync error:', itemError);
          results.items.conflicts.push({
            id: item.id,
            error: itemError.message
          });
        }
      }
    }

    if (customers && Array.isArray(customers)) {
      for (const customer of customers) {
        try {
          if (customer.idempotency_key) {
            const existingByIdempotency = await Customer.findOne({
              idempotency_key: customer.idempotency_key,
              company_code: companyCode
            });

            if (existingByIdempotency) {
              results.customers.synced.push({
                local_id: customer.id,
                cloud_id: existingByIdempotency._id.toString(),
              });
              continue;
            }
          }

          let existingCustomer = await Customer.findOne({
            _id: customer.id,
            company_code: companyCode
          });

          const customerUpdatedAt = new Date(customer.updated_at || customer.updatedAt || Date.now());
          const payload = { ...customer };
          delete payload.id;
          delete payload._id;

          if (existingCustomer) {
            if (customerUpdatedAt > existingCustomer.updatedAt) {
              await Customer.findByIdAndUpdate(existingCustomer._id, {
                ...payload,
                user_id: userId,
                company_code: companyCode,
                updatedAt: customerUpdatedAt
              });
            }
            existingCustomer = await Customer.findById(existingCustomer._id);
          } else {
            const newCustomer = new Customer({
              _id: customer.id,
              ...payload,
              user_id: userId,
              company_code: companyCode,
              updatedAt: customerUpdatedAt
            });
            existingCustomer = await newCustomer.save();
          }

          results.customers.synced.push({
            local_id: customer.id,
            cloud_id: existingCustomer._id.toString(),
          });
        } catch (customerError) {
          console.error('Customer sync error:', customerError);
          results.customers.conflicts.push({
            id: customer.id,
            error: customerError.message
          });
        }
      }
    }

    if (transactions && Array.isArray(transactions)) {
      for (const transaction of transactions) {
        try {
          if (transaction.idempotency_key) {
            const existingByIdempotency = await Transaction.findOne({
              idempotency_key: transaction.idempotency_key,
              company_code: companyCode
            });

            if (existingByIdempotency) {
              results.transactions.synced.push({
                local_id: transaction.id,
                cloud_id: existingByIdempotency._id.toString(),
                voucher_number: existingByIdempotency.voucher_number,
              });
              continue;
            }
          }

          let existingTx = await Transaction.findOne({
            _id: transaction.id,
            company_code: companyCode
          });

          const transactionUpdatedAt = new Date(transaction.updated_at || transaction.updatedAt || Date.now());
          const payload = { ...transaction };
          delete payload.id;
          delete payload._id;

          if (existingTx) {
            if (transactionUpdatedAt > existingTx.updatedAt) {
              await Transaction.findByIdAndUpdate(existingTx._id, {
                ...payload,
                user_id: userId,
                company_code: companyCode,
                updatedAt: transactionUpdatedAt
              });
            }
            existingTx = await Transaction.findById(existingTx._id);
          } else {
            const newTx = new Transaction({
              _id: transaction.id,
              ...payload,
              user_id: userId,
              company_code: companyCode,
              updatedAt: transactionUpdatedAt
            });
            existingTx = await newTx.save();
          }

          results.transactions.synced.push({
            local_id: transaction.id,
            cloud_id: existingTx._id.toString(),
            voucher_number: existingTx.voucher_number,
          });
        } catch (txError) {
          console.error('Transaction sync error:', txError);
          results.transactions.conflicts.push({
            id: transaction.id,
            error: txError.message
          });
        }
      }
    }

    res.json(results);
  } catch (error) {
    console.error('Push changes error:', error);
    res.status(500).json({ error: 'Failed to push changes' });
  }
};

export const pullChanges = async (req, res) => {
  const { since } = req.body;

  try {
    const companyCode = await resolveCompanyCode(req);
    if (!companyCode) {
      return res.status(403).json({ error: 'Company scope required' });
    }

    const sinceDate = since ? new Date(since) : new Date(0);

    const items = await Item.find({
      company_code: companyCode,
      updatedAt: { $gt: sinceDate }
    }).sort({ updatedAt: 1 });

    const customers = await Customer.find({
      company_code: companyCode,
      updatedAt: { $gt: sinceDate }
    }).sort({ updatedAt: 1 });

    const transactions = await Transaction.find({
      company_code: companyCode,
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
