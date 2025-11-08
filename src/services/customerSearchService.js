import { database } from '../db';

class CustomerSearchService {
  async searchCustomers(query, limit = 10) {
    try {
      if (!query || query.trim().length === 0) {
        return [];
      }

      const customersCollection = database.collections.get('customers');
      
      const allCustomers = await customersCollection.query().fetch();
      
      const queryLower = query.toLowerCase();
      
      const filtered = allCustomers.filter(customer => {
        const matchesName = customer.name?.toLowerCase().includes(queryLower);
        const matchesPhone = customer.phone?.includes(query);
        const matchesEmail = customer.email?.toLowerCase().includes(queryLower);
        
        return matchesName || matchesPhone || matchesEmail;
      });

      const sorted = filtered.sort((a, b) => {
        const aName = a.name?.toLowerCase() || '';
        const bName = b.name?.toLowerCase() || '';
        
        const aStartsWith = aName.startsWith(queryLower) ? 0 : 1;
        const bStartsWith = bName.startsWith(queryLower) ? 0 : 1;
        
        if (aStartsWith !== bStartsWith) {
          return aStartsWith - bStartsWith;
        }
        
        return aName.localeCompare(bName);
      });

      return sorted.slice(0, limit).map(customer => ({
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
      }));
    } catch (error) {
      console.error('Error searching customers:', error);
      return [];
    }
  }

  async getCustomerDetails(customerId) {
    try {
      const customersCollection = database.collections.get('customers');
      
      const customers = await customersCollection.query().fetch();
      const customer = customers.find(c => c.id === customerId);

      if (!customer) {
        return null;
      }

      return {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
      };
    } catch (error) {
      console.error('Error getting customer details:', error);
      return null;
    }
  }

  async addNewCustomer(name, phone, email, address) {
    try {
      const customersCollection = database.collections.get('customers');
      
      const newCustomer = await database.write(async () => {
        return await customersCollection.create(customer => {
          customer.id = `customer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          customer.name = name;
          customer.phone = phone;
          customer.email = email;
          customer.address = address;
          customer.is_synced = false;
          customer.sync_status = 'pending';
          customer.created_at = Date.now();
          customer.updated_at = Date.now();
        });
      });

      return {
        success: true,
        customer: {
          id: newCustomer.id,
          name: newCustomer.name,
          phone: newCustomer.phone,
          email: newCustomer.email,
          address: newCustomer.address,
        }
      };
    } catch (error) {
      console.error('Error adding new customer:', error);
      return { success: false, error: error.message };
    }
  }

  async getAllCustomers() {
    try {
      const customersCollection = database.collections.get('customers');
      const customers = await customersCollection.query().fetch();
      
      return customers.map(customer => ({
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
      }));
    } catch (error) {
      console.error('Error getting all customers:', error);
      return [];
    }
  }
}

export default new CustomerSearchService();
