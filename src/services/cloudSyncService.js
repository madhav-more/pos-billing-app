import {createClient} from '@supabase/supabase-js';
import Constants from 'expo-constants';
import {database} from '../db';
import {isCloudAuthEnabled} from './privacyService';
import {getAuthToken} from './supabaseAuthService';

const SUPABASE_URL = Constants.expoConfig?.extra?.supabaseUrl || 'https://qkfvufijxgcvjjkwlbpc.supabase.co';
const SUPABASE_ANON_KEY = Constants.expoConfig?.extra?.supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFrZnZ1ZmlqeGdjdmpqa3dsYnBjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1MDM0NzUsImV4cCI6MjA3NzA3OTQ3NX0.gh2Dj-UskPmSfhH9h3VygD8Hi5ZWAXu345ko1B0o1j0';

let supabaseClient = null;

function getSupabaseClient() {
  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return supabaseClient;
}

/**
 * Sync items to cloud
 */
export async function syncItemsToCloud() {
  try {
    const cloudAuthEnabled = await isCloudAuthEnabled();
    if (!cloudAuthEnabled) {
      console.log('Cloud auth disabled, skipping item sync');
      return {success: false, error: 'Cloud auth disabled'};
    }

    const token = await getAuthToken();
    if (!token) {
      console.log('No auth token, skipping sync');
      return {success: false, error: 'Not authenticated'};
    }

    const itemsCollection = database.collections.get('items');
    const items = await itemsCollection.query().fetch();

    const client = getSupabaseClient();
    
    // Get current user
    const {data: {user}} = await client.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    
    const itemsData = items.map(item => ({
      id: item.id,
      user_id: user.id,
      name: item.name,
      barcode: item.barcode,
      price: item.price,
      unit: item.unit,
      category: item.category,
      recommended: item.recommended,
      default_quantity: item.defaultQuantity,
      created_at: item.createdAt,
      updated_at: item.updatedAt,
    }));

    const {data, error} = await client
      .from('items')
      .upsert(itemsData, {onConflict: 'id'});

    if (error) throw error;

    console.log('Items synced to cloud:', itemsData.length);
    return {success: true, count: itemsData.length};
  } catch (error) {
    console.error('Error syncing items:', error);
    return {success: false, error: error.message};
  }
}

/**
 * Sync transactions/sales to cloud
 */
export async function syncTransactionsToCloud() {
  try {
    const cloudAuthEnabled = await isCloudAuthEnabled();
    if (!cloudAuthEnabled) {
      console.log('Cloud auth disabled, skipping transaction sync');
      return {success: false, error: 'Cloud auth disabled'};
    }

    const token = await getAuthToken();
    if (!token) {
      console.log('No auth token, skipping sync');
      return {success: false, error: 'Not authenticated'};
    }

    const transactionsCollection = database.collections.get('transactions');
    const transactions = await transactionsCollection.query().fetch();

    const client = getSupabaseClient();
    
    // Get current user
    const {data: {user}} = await client.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    
    const transactionsData = transactions.map(txn => ({
      id: txn.id,
      user_id: user.id,
      total: txn.total,
      items_json: txn.itemsJson,
      payment_method: txn.paymentMethod,
      created_at: txn.createdAt,
    }));

    const {data, error} = await client
      .from('transactions')
      .upsert(transactionsData, {onConflict: 'id'});

    if (error) throw error;

    console.log('Transactions synced to cloud:', transactionsData.length);
    return {success: true, count: transactionsData.length};
  } catch (error) {
    console.error('Error syncing transactions:', error);
    return {success: false, error: error.message};
  }
}

/**
 * Pull items from cloud
 */
export async function pullItemsFromCloud() {
  try {
    const cloudAuthEnabled = await isCloudAuthEnabled();
    if (!cloudAuthEnabled) {
      return {success: false, error: 'Cloud auth disabled'};
    }

    const token = await getAuthToken();
    if (!token) {
      return {success: false, error: 'Not authenticated'};
    }

    const client = getSupabaseClient();
    const {data, error} = await client
      .from('items')
      .select('*')
      .order('created_at', {ascending: false});

    if (error) throw error;

    // Update local database
    await database.write(async () => {
      const itemsCollection = database.collections.get('items');
      
      for (const cloudItem of data) {
        try {
          const existing = await itemsCollection.find(cloudItem.id);
          await existing.update(item => {
            item.name = cloudItem.name;
            item.barcode = cloudItem.barcode;
            item.price = cloudItem.price;
            item.unit = cloudItem.unit;
            item.category = cloudItem.category;
            item.recommended = cloudItem.recommended;
            item.defaultQuantity = cloudItem.default_quantity;
          });
        } catch (notFoundError) {
          // Create new item if not exists
          await itemsCollection.create(item => {
            item._raw.id = cloudItem.id;
            item.name = cloudItem.name;
            item.barcode = cloudItem.barcode;
            item.price = cloudItem.price;
            item.unit = cloudItem.unit;
            item.category = cloudItem.category;
            item.recommended = cloudItem.recommended;
            item.defaultQuantity = cloudItem.default_quantity;
          });
        }
      }
    });

    console.log('Items pulled from cloud:', data.length);
    return {success: true, count: data.length};
  } catch (error) {
    console.error('Error pulling items:', error);
    return {success: false, error: error.message};
  }
}

/**
 * Auto-sync on app start
 */
export async function autoSync() {
  try {
    const cloudAuthEnabled = await isCloudAuthEnabled();
    if (!cloudAuthEnabled) {
      console.log('Cloud sync disabled');
      return;
    }

    const token = await getAuthToken();
    if (!token) {
      console.log('Not authenticated, skipping auto-sync');
      return;
    }

    console.log('Starting auto-sync...');
    
    // Push local data to cloud
    await syncItemsToCloud();
    await syncTransactionsToCloud();
    
    console.log('Auto-sync completed');
  } catch (error) {
    console.error('Auto-sync error:', error);
  }
}
