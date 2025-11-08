import { database } from '../db';
import enhancedSyncService from './enhancedSyncService';

/**
 * Customer Service for autosuggest, search, and management
 */
class CustomerService {
  constructor() {
    this.searchCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Search customers with autosuggest functionality
   */
  async searchCustomers(query, options = {}) {
    const { 
      limit = 10, 
      searchFields = ['name', 'phone', 'email'],
      includeCloud = true 
    } = options;

    try {
      // Check cache first
      const cacheKey = `${query}-${limit}-${searchFields.join(',')}`;
      const cached = this.searchCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.results;
      }

      // Search local database
      const customersCollection = database.collections.get('customers');
      const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 0);

      let localResults = [];
      
      if (searchTerms.length > 0) {
        const allCustomers = await customersCollection.query().fetch();
        
        localResults = allCustomers.filter(customer => {
          const searchableText = searchFields.map(field => 
            customer[field] ? customer[field].toString().toLowerCase() : ''
          ).join(' ');
          
          return searchTerms.every(term => searchableText.includes(term));
        }).slice(0, limit);
      }

      // Sort by relevance (exact matches first, then partial)
      localResults.sort((a, b) => {
        const aScore = this.calculateRelevanceScore(a, query, searchFields);
        const bScore = this.calculateRelevanceScore(b, query, searchFields);
        return bScore - aScore;
      });

      // If online and includeCloud, also search cloud database
      let cloudResults = [];
      if (includeCloud && await enhancedSyncService.canSync()) {
        try {
          cloudResults = await this.searchCloudCustomers(query, options);
        } catch (error) {
          console.warn('Cloud search failed, using local results only:', error);
        }
      }

      // Merge and deduplicate results
      const allResults = this.mergeResults(localResults, cloudResults, limit);

      // Cache results
      this.searchCache.set(cacheKey, {
        results: allResults,
        timestamp: Date.now()
      });

      return allResults;
    } catch (error) {
      console.error('Customer search error:', error);
      throw error;
    }
  }

  /**
   * Calculate relevance score for sorting
   */
  calculateRelevanceScore(customer, query, searchFields) {
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
  }

  /**
   * Search cloud customers (when online)
   */
  async searchCloudCustomers(query, options = {}) {
    const { limit = 10 } = options;
    
    try {
      const token = await this.getAuthToken();
      if (!token) return [];

      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/customers/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ query, limit }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.customers || [];
      }
      
      return [];
    } catch (error) {
      console.error('Cloud customer search error:', error);
      return [];
    }
  }

  /**
   * Merge local and cloud results, removing duplicates
   */
  mergeResults(localResults, cloudResults, limit) {
    const merged = [];
    const seen = new Set();

    // Add local results first (they have priority)
    localResults.forEach(customer => {
      const key = customer.phone || customer.email || customer.name;
      if (!seen.has(key)) {
        merged.push({
          ...customer,
          source: 'local'
        });
        seen.add(key);
      }
    });

    // Add cloud results that aren't already in local
    cloudResults.forEach(customer => {
      const key = customer.phone || customer.email || customer.name;
      if (!seen.has(key)) {
        merged.push({
          ...customer,
          source: 'cloud'
        });
        seen.add(key);
      }
    });

    return merged.slice(0, limit);
  }

  /**
   * Get customer by ID
   */
  async getCustomerById(customerId) {
    try {
      const customersCollection = database.collections.get('customers');
      const customer = await customersCollection.find(customerId);
      return customer;
    } catch (error) {
      console.error('Get customer by ID error:', error);
      throw error;
    }
  }

  /**
   * Get customer by phone number
   */
  async getCustomerByPhone(phone) {
    try {
      const customersCollection = database.collections.get('customers');
      const customers = await customersCollection.query().fetch();
      const customer = customers.find(c => c.phone === phone);
      return customer || null;
    } catch (error) {
      console.error('Get customer by phone error:', error);
      return null;
    }
  }

  /**
   * Get customer by email
   */
  async getCustomerByEmail(email) {
    try {
      const customersCollection = database.collections.get('customers');
      const customers = await customersCollection.query().fetch();
      const customer = customers.find(c => c.email === email);
      return customer || null;
    } catch (error) {
      console.error('Get customer by email error:', error);
      return null;
    }
  }

  /**
   * Create or update customer
   */
  async saveCustomer(customerData) {
    try {
      const { localId, name, phone, email, address } = customerData;
      const customersCollection = database.collections.get('customers');

      let customer;
      
      if (localId) {
        // Update existing customer
        customer = await customersCollection.find(localId);
        await customer.update(record => {
          record.name = name;
          record.phone = phone;
          record.email = email;
          record.address = address;
          record.isSynced = false;
          record.updatedAt = new Date().toISOString();
        });
      } else {
        // Create new customer
        const { v4: uuidv4 } = require('uuid');
        customer = await customersCollection.create(record => {
          record.localId = uuidv4();
          record.cloudId = null;
          record.userId = customerData.userId;
          record.name = name;
          record.phone = phone;
          record.email = email;
          record.address = address;
          record.isSynced = false;
          record.syncedAt = null;
          record.updatedAt = new Date().toISOString();
          record.idempotencyKey = `customer-${record.localId}-${Date.now()}`;
        });
      }

      // Clear search cache for this customer
      this.clearSearchCache();

      return customer;
    } catch (error) {
      console.error('Save customer error:', error);
      throw error;
    }
  }

  /**
   * Auto-fill customer details based on partial information
   */
  async autoFillCustomer(partialData) {
    try {
      const { phone, email, name } = partialData;
      let customer = null;

      // Try to find by phone first (most reliable)
      if (phone) {
        customer = await this.getCustomerByPhone(phone);
      }

      // Try email if phone didn't work
      if (!customer && email) {
        customer = await this.getCustomerByEmail(email);
      }

      // Try name search if still not found
      if (!customer && name) {
        const results = await this.searchCustomers(name, { limit: 1, includeCloud: false });
        if (results.length > 0) {
          customer = results[0];
        }
      }

      if (customer) {
        return {
          found: true,
          customer: {
            localId: customer.localId,
            name: customer.name,
            phone: customer.phone,
            email: customer.email,
            address: customer.address
          },
          suggestions: [] // Could add similar customers here
        };
      } else {
        // If no exact match, provide suggestions
        const suggestions = await this.searchCustomers(
          phone || email || name || '',
          { limit: 5, includeCloud: false }
        );

        return {
          found: false,
          customer: null,
          suggestions: suggestions.map(suggestion => ({
            localId: suggestion.localId,
            name: suggestion.name,
            phone: suggestion.phone,
            email: suggestion.email,
            address: suggestion.address
          }))
        };
      }
    } catch (error) {
      console.error('Auto-fill customer error:', error);
      return {
        found: false,
        customer: null,
        suggestions: []
      };
    }
  }

  /**
   * Get recent customers
   */
  async getRecentCustomers(limit = 10) {
    try {
      const customersCollection = database.collections.get('customers');
      const recentCustomers = await customersCollection
        .query()
        .sortBy('updated_at', 'desc')
        .fetch();

      return recentCustomers.slice(0, limit);
    } catch (error) {
      console.error('Get recent customers error:', error);
      return [];
    }
  }

  /**
   * Clear search cache
   */
  clearSearchCache() {
    this.searchCache.clear();
  }

  /**
   * Get auth token (helper method)
   */
  async getAuthToken() {
    try {
      const enhancedAuthService = require('./enhancedAuthService');
      return enhancedAuthService.getAuthToken();
    } catch (error) {
      console.error('Get auth token error:', error);
      return null;
    }
  }
}

// Create singleton instance
const customerService = new CustomerService();

export default customerService;