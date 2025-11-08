import Customer from '../models/Customer.js';

/**
 * Search customers with autosuggest functionality
 */
export const searchCustomers = async (req, res) => {
  const { query, limit = 10, searchFields = ['name', 'phone', 'email'] } = req.body;
  const userId = req.user.userId;

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Query parameter is required' });
  }

  try {
    // Build search conditions
    const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 0);
    
    if (searchTerms.length === 0) {
      return res.json({ customers: [] });
    }

    // Create regex patterns for each search term
    const regexPatterns = searchTerms.map(term => new RegExp(term, 'i'));

    // Build MongoDB query
    const conditions = {
      user_id: userId,
      $or: searchFields.map(field => ({
        [field]: { $in: regexPatterns }
      }))
    };

    // Execute search with relevance scoring
    const customers = await Customer.find(conditions).limit(limit * 2); // Get more to allow for scoring

    // Calculate relevance scores and sort
    const scoredCustomers = customers.map(customer => {
      const score = calculateRelevanceScore(customer, query, searchFields);
      return { ...customer.toObject(), relevanceScore: score };
    });

    // Sort by relevance score and take top results
    const sortedCustomers = scoredCustomers
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);

    res.json({ 
      customers: sortedCustomers,
      total: sortedCustomers.length,
      query: query
    });

  } catch (error) {
    console.error('Search customers error:', error);
    res.status(500).json({ error: 'Failed to search customers' });
  }
};

/**
 * Calculate relevance score for customer search
 */
const calculateRelevanceScore = (customer, query, searchFields) => {
  let score = 0;
  const queryLower = query.toLowerCase();
  
  searchFields.forEach(field => {
    const value = customer[field] ? customer[field].toString().toLowerCase() : '';
    
    // Exact match gets highest score
    if (value === queryLower) {
      score += 100;
    }
    // Starts with query gets high score
    else if (value.startsWith(queryLower)) {
      score += 50;
    }
    // Contains query gets medium score
    else if (value.includes(queryLower)) {
      score += 25;
    }
    // Word-level match gets low score
    else if (value.split(' ').some(word => word.startsWith(queryLower))) {
      score += 10;
    }
  });

  return score;
};

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
