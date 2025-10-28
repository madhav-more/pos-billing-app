import {createClient} from '@supabase/supabase-js';
import NetInfo from '@react-native-community/netinfo';
import Constants from 'expo-constants';
import {database} from '../db';
import {isCloudAuthEnabled} from './privacyService';
import {getAuthToken} from './supabaseAuthService';

const SUPABASE_URL = Constants.expoConfig?.extra?.supabaseUrl || 'https://ipkpwwakgtezmjcsccif.supabase.co';
const SUPABASE_ANON_KEY = Constants.expoConfig?.extra?.supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlwa3B3d2FrZ3Rlem1qY3NjY2lmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0MzQyMjgsImV4cCI6MjA3NzAxMDIyOH0.KOgMQ79r939cGzbpSWhF7I6NIC08-RTSWTQoaB6CZl4';

let supabaseClient = null;

function getSupabaseClient() {
  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return supabaseClient;
}

/**
 * Check if device is online
 */
export async function isOnline() {
  const netInfo = await NetInfo.fetch();
  return netInfo.isConnected && netInfo.isInternetReachable;
}

/**
 * Sync items to Supabase
 */
export async function syncItems() {
  try {
    const cloudAuthEnabled = await isCloudAuthEnabled();
    if (!cloudAuthEnabled) {
      console.log('Cloud sync disabled');
      return {success: false, message: 'Cloud sync disabled'};
    }

    const online = await isOnline();
    if (!online) {
      console.log('Device offline, skipping sync');
      return {success: false, message: 'Device offline'};
    }

    const token = await getAuthToken();
    if (!token) {
      console.log('Not authenticated, skipping sync');
      return {success: false, message: 'Not authenticated'};
    }

    const itemsCollection = database.collections.get('items');
    const unsyncedItems = await itemsCollection
      .query()
      .fetch()
      .then(items => items.filter(item => !item.syncedToCloud));

    if (unsyncedItems.length === 0) {
      return {success: true, synced: 0};
    }

    const client = getSupabaseClient();
    const itemsData = unsyncedItems.map(item => ({
      local_id: item.id,
      name: item.name,
      category: item.category,
      unit: item.unit,
      price: item.price,
      cost_price: item.costPrice,
      mrp: item.mrp,
      min_stock: item.minStock,
      current_stock: item.currentStock,
      recommended: item.recommended,
    }));

    const {data, error} = await client
      .from('items')
      .upsert(itemsData, {onConflict: 'local_id'});

    if (error) throw error;

    // Mark items as synced
    await database.write(async () => {
      for (const item of unsyncedItems) {
        await item.update(i => {
          i.syncedToCloud = true;
        });
      }
    });

    return {success: true, synced: unsyncedItems.length};
  } catch (error) {
    console.error('Sync error:', error);
    return {success: false, error: error.message};
  }
}

/**
 * Auto-sync when online
 */
export function startAutoSync(intervalMs = 30000) {
  const syncInterval = setInterval(async () => {
    const result = await syncItems();
    if (result.success && result.synced > 0) {
      console.log(`Auto-synced ${result.synced} items`);
    }
  }, intervalMs);

  return () => clearInterval(syncInterval);
}
