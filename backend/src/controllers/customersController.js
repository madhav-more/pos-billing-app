import Customer from '../models/Customer.js';

export const getCustomers = async (req, res) => {
  const { since } = req.query;
  const userId = req.user.userId;

  try {
    const query = { user_id: userId };
    if (since) {
      query.updatedAt = { $gt: new Date(since) };
    }

    const customers = await Customer.find(query).sort({ updatedAt: -1 });
    res.json({ customers });
  } catch (error) {
    console.error('Get customers error:', error);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
};

export const createCustomersBatch = async (req, res) => {
  const { customers } = req.body;
  const userId = req.user.userId;

  if (!Array.isArray(customers) || customers.length === 0) {
    return res.status(400).json({ error: 'Customers array is required' });
  }

  try {
    const createdCustomers = [];
    const warnings = [];

    for (const customer of customers) {
      const { id, name, phone, email, address, updated_at } = customer;

      if (!id || !name) {
        warnings.push({ customer, error: 'Missing required fields: id or name' });
        continue;
      }

      const existingCustomer = await Customer.findById(id);
      const customerUpdatedAt = updated_at ? new Date(updated_at) : new Date();

      if (existingCustomer && existingCustomer.updatedAt > customerUpdatedAt) {
        warnings.push({ id, error: 'Server version is newer' });
        continue;
      }

      const upsertedCustomer = await Customer.findByIdAndUpdate(
        id,
        {
          _id: id,
          user_id: userId,
          name,
          phone,
          email,
          address,
          updatedAt: customerUpdatedAt
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      createdCustomers.push(upsertedCustomer);
    }

    res.json({ customers: createdCustomers, warnings });
  } catch (error) {
    console.error('Batch create customers error:', error);
    res.status(500).json({ error: 'Failed to create customers' });
  }
};

export const updateCustomer = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userId;
  const updates = req.body;

  try {
    const customer = await Customer.findOneAndUpdate(
      { _id: id, user_id: userId },
      { $set: updates },
      { new: true }
    );

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json({ customer });
  } catch (error) {
    console.error('Update customer error:', error);
    res.status(500).json({ error: 'Failed to update customer' });
  }
};
