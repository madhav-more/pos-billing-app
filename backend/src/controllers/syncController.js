import Item from '../models/Item.js';
import Customer from '../models/Customer.js';
import Transaction from '../models/Transaction.js';
import { resolveCompanyCode } from '../utils/companyScope.js';

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

export const pushChanges = async (req, res) => {
  const { items, customers, transactions } = req.body;
  const userId = req.user.userId;

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

    // Process items with idempotency key deduplication
    if (items && Array.isArray(items)) {
      for (const item of items) {
        try {
          // Check for duplicate using idempotency key first
          if (item.idempotency_key) {
            const existingByIdempotency = await Item.findOne({ 
              idempotency_key: item.idempotency_key,
              company_code: companyCode,
            });
            
            if (existingByIdempotency) {
              // This is a duplicate request, return existing item
              results.items.synced.push({
                local_id: item.id,
                cloud_id: existingByIdempotency._id,
              });
              continue;
            }
          }

          // Check if item exists (using local_id as unique identifier)
          let existingItem = await Item.findOne({ _id: item.id, company_code: companyCode });
          
          if (existingItem) {
            // Update existing item with conflict resolution (last-write-wins)
            const itemDate = new Date(item.updatedAt || item.updated_at);
            if (itemDate > existingItem.updatedAt) {
              // Exclude _id from update to avoid immutable field error
              const { _id, ...itemWithoutId } = item;
              await Item.findByIdAndUpdate(existingItem._id, {
                ...itemWithoutId,
                user_id: userId,
                company_code: companyCode,
                updatedAt: itemDate
              });
            }
          } else {
            // Create new item
            const newItem = new Item({
              ...item,
              user_id: userId,
              company_code: companyCode,
              updatedAt: new Date(item.updatedAt || item.updated_at || Date.now())
            });
            await newItem.save();
            existingItem = newItem;
          }
          
          results.items.synced.push({
            local_id: item.id,
            cloud_id: existingItem._id,
          });
        } catch (itemError) {
          console.error('Error processing item:', itemError);
          results.items.conflicts.push({ id: item.id, error: itemError.message });
        }
      }
    }

    // Process customers with idempotency key deduplication
    if (customers && Array.isArray(customers)) {
      for (const customer of customers) {
        try {
          // Check for duplicate using idempotency key first
          if (customer.idempotency_key) {
            const existingByIdempotency = await Customer.findOne({ 
              idempotency_key: customer.idempotency_key,
              company_code: companyCode,
            });
            
            if (existingByIdempotency) {
              // This is a duplicate request, return existing customer
              results.customers.synced.push({
                local_id: customer.id,
                cloud_id: existingByIdempotency._id,
              });
              continue;
            }
          }

          // Check if customer exists
          let existingCustomer = await Customer.findOne({ _id: customer.id, company_code: companyCode });
          
          if (existingCustomer) {
            // Update existing customer with conflict resolution (last-write-wins)
            const customerDate = new Date(customer.updatedAt || customer.updated_at);
            if (customerDate > existingCustomer.updatedAt) {
              // Exclude _id from update to avoid immutable field error
              const { _id, ...customerWithoutId } = customer;
              await Customer.findByIdAndUpdate(existingCustomer._id, {
                ...customerWithoutId,
                user_id: userId,
                company_code: companyCode,
                updatedAt: customerDate
              });
            }
          } else {
            // Create new customer
            const newCustomer = new Customer({
              ...customer,
              user_id: userId,
              company_code: companyCode,
              updatedAt: new Date(customer.updatedAt || customer.updated_at || Date.now())
            });
            await newCustomer.save();
            existingCustomer = newCustomer;
          }
          
          results.customers.synced.push({
            local_id: customer.id,
            cloud_id: existingCustomer._id,
          });
        } catch (customerError) {
          console.error('Error processing customer:', customerError);
          results.customers.conflicts.push({ id: customer.id, error: customerError.message });
        }
      }
    }

    // Process transactions with idempotency key deduplication (append only)
    if (transactions && Array.isArray(transactions)) {
      for (const transaction of transactions) {
        try {
          // Check for duplicate using idempotency key first
          if (transaction.idempotency_key) {
            const existingByIdempotency = await Transaction.findOne({ 
              idempotency_key: transaction.idempotency_key,
              company_code: companyCode,
            });
            
            if (existingByIdempotency) {
              // This is a duplicate request, return existing transaction
              results.transactions.synced.push({
                local_id: transaction.id,
                cloud_id: existingByIdempotency._id,
                voucher_number: existingByIdempotency.voucher_number,
              });
              continue;
            }
          }

          // Check if transaction exists
          const existingTransaction = await Transaction.findOne({ _id: transaction.id, company_code: companyCode });
          
          if (!existingTransaction) {
            // Generate voucher number if provisional
            let voucherNumber = transaction.voucher_number;
            if (!voucherNumber || transaction.provisional_voucher) {
              // Generate server-side voucher number
              const today = new Date();
              const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
              
              // Get today's sequence number
              const todayTransactions = await Transaction.find({
                company_code: companyCode,
                voucher_number: { $regex: `^.*-${dateStr}-` }
              }).sort({ voucher_number: -1 }).limit(1);
              
              let sequence = 1;
              if (todayTransactions.length > 0) {
                const lastVoucher = todayTransactions[0].voucher_number;
                const lastSeq = parseInt(lastVoucher.split('-').pop());
                sequence = lastSeq + 1;
              }
              
              // Skip User lookup for simple auth (UUID strings)
              // Only lookup if userId looks like MongoDB ObjectId (24 hex chars)
              const voucherPrefix = companyCode || 'GUR';
              voucherNumber = `${voucherPrefix}-${dateStr}-${sequence.toString().padStart(4, '0')}`;
            }

            // Create new transaction (append only)
            const newTransaction = new Transaction({
              ...transaction,
              user_id: userId,
              voucher_number: voucherNumber,
              provisional_voucher: null, // Clear provisional voucher
              updatedAt: new Date(transaction.updatedAt || transaction.updated_at || Date.now())
            });
            await newTransaction.save();
            
            results.transactions.synced.push({
              local_id: transaction.id,
              cloud_id: newTransaction._id,
              voucher_number: voucherNumber,
            });
          }
        } catch (transactionError) {
          console.error('Error processing transaction:', transactionError);
          results.transactions.conflicts.push({ id: transaction.id, error: transactionError.message });
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
