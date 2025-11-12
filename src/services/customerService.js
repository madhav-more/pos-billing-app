import { database } from '../db';
import { Q } from '@nozbe/watermelondb';
import enhancedSyncService from './enhancedSyncService';
import simpleAuthService from './simpleAuthService';
import { generateUUID } from '../utils/uuid';

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
      const cacheKey = `${query}-${limit}-${searchFields.join(',')}-${includeCloud ? 'cloud' : 'local'}`;
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

        const filteredCustomers = allCustomers.filter(customer => {
          const searchableText = searchFields
            .map(field => (customer[field] ? customer[field].toString().toLowerCase() : ''))
            .join(' ');

          return searchTerms.every(term => searchableText.includes(term));
        });

        localResults = filteredCustomers
          .map(customer => this.formatCustomerRecord(customer, 'local'))
          .filter(Boolean);
      }

      // Sort by relevance (exact matches first, then partial)
      localResults.sort((a, b) => {
        const aScore = this.calculateRelevanceScore(a, query, searchFields);
        const bScore = this.calculateRelevanceScore(b, query, searchFields);
        return bScore - aScore;
      });

      // Limit local results to prioritize best matches while allowing room for cloud suggestions
      localResults = localResults.slice(0, limit * 2);

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
    const {
      limit = 10,
      searchFields = ['name', 'phone', 'email'],
    } = options;
    
    try {
      const headers = {
        'Content-Type': 'application/json',
      };

      const token = await this.getAuthToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      } else {
        const simpleUserId = simpleAuthService.getUserId();
        if (!simpleUserId) {
          return [];
        }
        headers['X-User-ID'] = simpleUserId;
      }

      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/customers/search`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query, limit, searchFields }),
      });

      if (response.ok) {
        const data = await response.json();
        const customers = data.customers || [];
        return customers
          .map(customer => this.formatCustomerRecord(customer, 'cloud'))
          .filter(Boolean);
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

  async getCustomerByLocalId(localId) {
    return await this.findCustomerByColumn('local_id', localId);
  }

  /**
   * Get customer by phone number
   */
  async getCustomerByPhone(phone) {
    const normalizedPhone = this.normalizeCustomerFields({ phone }).phone;
    return await this.findCustomerByColumn('phone', normalizedPhone);
  }

  /**
   * Get customer by email
   */
  async getCustomerByEmail(email) {
    const normalizedEmail = this.normalizeCustomerFields({ email }).email;
    return await this.findCustomerByColumn('email', normalizedEmail);
  }

  /**
   * Create or update customer
   */
  async saveCustomer(customerData) {
    try {
      const customersCollection = database.collections.get('customers');
      const normalized = this.normalizeCustomerFields(customerData);
      const userId = customerData?.userId || simpleAuthService.getUserId() || null;

      let existingCustomer = null;

      if (customerData?.id) {
        try {
          existingCustomer = await customersCollection.find(customerData.id);
        } catch (findError) {
          existingCustomer = null;
        }
      }

      if (!existingCustomer && customerData?.localId) {
        existingCustomer = await this.findCustomerByColumn('local_id', customerData.localId);
      }

      if (!existingCustomer && customerData?.cloudId) {
        existingCustomer = await this.findCustomerByColumn('cloud_id', customerData.cloudId);
      }

      if (!existingCustomer && normalized.phone) {
        existingCustomer = await this.findCustomerByColumn('phone', normalized.phone);
      }

      if (!existingCustomer && normalized.email) {
        existingCustomer = await this.findCustomerByColumn('email', normalized.email);
      }

      const timestamp = Date.now();
      const baseQueuePayload = {
        name: normalized.name,
        phone: normalized.phone,
        email: normalized.email,
        address: normalized.address,
        user_id: userId,
        updated_at: timestamp,
      };

      const upsertedCustomer = await database.write(async () => {
        if (existingCustomer) {
          await existingCustomer.update(record => {
            record.name = normalized.name;
            record.phone = normalized.phone;
            record.email = normalized.email;
            record.address = normalized.address;
            if (customerData?.cloudId) {
              record.cloudId = customerData.cloudId;
            }
            record.userId = userId;
            record.isSynced = false;
            record.syncedAt = null;
            record.syncStatus = 'pending';
            record.syncError = null;
            record.lastSyncAttempt = null;
            if (!record.localId) {
              record.localId = generateUUID();
            }
            if (!record.idempotencyKey) {
              record.idempotencyKey = `customer-${record.localId}`;
            }
            record._raw.updated_at = timestamp;
          });
          await this.upsertSyncQueue(existingCustomer, baseQueuePayload, timestamp);
          return existingCustomer;
        }

        const localId = customerData?.localId || generateUUID();
        const idempotencyKey = customerData?.idempotencyKey || `customer-${localId}-${timestamp}`;

        const createdCustomer = await customersCollection.create(record => {
          record.localId = localId;
          record.cloudId = customerData?.cloudId || null;
          record.userId = userId;
          record.name = normalized.name;
          record.phone = normalized.phone;
          record.email = normalized.email;
          record.address = normalized.address;
          record.isSynced = false;
          record.syncedAt = null;
          record.syncStatus = 'pending';
          record.syncError = null;
          record.lastSyncAttempt = null;
          record.idempotencyKey = idempotencyKey;
          record._raw.created_at = timestamp;
          record._raw.updated_at = timestamp;
        });
        await this.upsertSyncQueue(
          createdCustomer,
          {...baseQueuePayload, created_at: timestamp, idempotency_key: idempotencyKey},
          timestamp,
        );
        return createdCustomer;
      });

      this.clearSearchCache();

      return upsertedCustomer;
    } catch (error) {
      console.error('Save customer error:', error);
      throw error;
    }
  }

  normalizeCustomerFields(customerData = {}) {
    const sanitize = value => {
      const trimmed = (value ?? '').toString().trim();
      return trimmed.length > 0 ? trimmed : null;
    };
    const name = sanitize(customerData.name);

    return {
      name: name || 'Customer',
      phone: sanitize(customerData.phone),
      email: sanitize(customerData.email),
      address: sanitize(customerData.address),
    };
  }

  formatCustomerRecord(customer, source = 'local') {
    if (!customer) {
      return null;
    }

    const candidates = [
      customer.id,
      customer._id,
      customer.localId,
      customer.local_id,
      customer.cloudId,
      customer.cloud_id,
      customer.phone,
      customer.email,
    ].filter(Boolean);

    const identifier = candidates.length > 0 ? candidates[0].toString() : `temp-${generateUUID()}`;

    return {
      id: identifier,
      localId: (customer.localId || customer.local_id || null) ?? null,
      cloudId: (customer.cloudId || customer.cloud_id || customer._id || null) ?? null,
      userId: customer.userId || customer.user_id || null,
      name: customer.name || '',
      phone: customer.phone || '',
      email: customer.email || '',
      address: customer.address || '',
      source,
    };
  }

  buildCustomerKey(record) {
    if (!record) {
      return '';
    }

    return [
      (record.phone || '').toLowerCase(),
      (record.email || '').toLowerCase(),
      (record.localId || '').toString().toLowerCase(),
      (record.cloudId || '').toString().toLowerCase(),
      (record.name || '').toLowerCase(),
    ].join('|');
  }

  async findCustomerByColumn(column, value) {
    if (!value) {
      return null;
    }

    try {
      const customersCollection = database.collections.get('customers');
      const results = await customersCollection.query(Q.where(column, value)).fetch();
      return results[0] || null;
    } catch (error) {
      console.error(`Find customer by ${column} error:`, error);
      return null;
    }
  }

  async upsertSyncQueue(customerRecord, payload, timestamp) {
    try {
      const queueCollection = database.collections.get('sync_queue');
      if (!queueCollection) {
        return;
      }

      const queueTimestamp = timestamp ?? Date.now();
      const rawRecord = customerRecord?._raw || {};
      const entityId = customerRecord.localId || rawRecord.local_id || customerRecord.id;
      const serializedPayload = JSON.stringify({
        ...payload,
        local_id: customerRecord.localId || rawRecord.local_id,
        cloud_id: customerRecord.cloudId || rawRecord.cloud_id || null,
        idempotency_key: customerRecord.idempotencyKey || rawRecord.idempotency_key,
        updated_at: payload?.updated_at ?? rawRecord.updated_at ?? queueTimestamp,
        created_at: payload?.created_at ?? rawRecord.created_at ?? queueTimestamp,
      });

      const existingEntries = await queueCollection
        .query(
          Q.where('entity_type', 'customer'),
          Q.where('entity_id', entityId),
        )
        .fetch();

      if (existingEntries.length > 0) {
        await existingEntries[0].update(entry => {
          entry.operation = 'upsert';
          entry.data = serializedPayload;
          entry.retryCount = 0;
          entry.lastError = null;
          entry._raw.updated_at = queueTimestamp;
        });
      } else {
        await queueCollection.create(entry => {
          entry.entityType = 'customer';
          entry.entityId = entityId;
          entry.operation = 'upsert';
          entry.data = serializedPayload;
          entry.retryCount = 0;
          entry.lastError = null;
          entry._raw.created_at = queueTimestamp;
          entry._raw.updated_at = queueTimestamp;
        });
      }
    } catch (error) {
      console.warn('Sync queue update failed for customer:', error);
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
        const results = await this.searchCustomers(name, { limit: 1, includeCloud: true });
        if (results.length > 0) {
          customer = results[0];
        }
      }

      if (customer) {
        return {
          found: true,
          customer: {
            localId: customer.localId || customer.local_id || null,
            cloudId: customer.cloudId || customer.cloud_id || null,
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
          { limit: 5, includeCloud: true }
        );

        return {
          found: false,
          customer: null,
          suggestions: suggestions.map(suggestion => ({
            localId: suggestion.localId,
            cloudId: suggestion.cloudId || null,
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