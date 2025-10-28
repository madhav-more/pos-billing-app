import {createClient} from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import {logAuditEvent, isCloudAuthEnabled} from './privacyService';

const SUPABASE_URL = Constants.expoConfig?.extra?.supabaseUrl || 'https://qkfvufijxgcvjjkwlbpc.supabase.co';
const SUPABASE_ANON_KEY = Constants.expoConfig?.extra?.supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFrZnZ1ZmlqeGdjdmpqa3dsYnBjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1MDM0NzUsImV4cCI6MjA3NzA3OTQ3NX0.gh2Dj-UskPmSfhH9h3VygD8Hi5ZWAXu345ko1B0o1j0';

let supabaseClient = null;

/**
 * Initialize Supabase client (only if cloud auth is enabled)
 */
async function getSupabaseClient() {
  const cloudAuthEnabled = await isCloudAuthEnabled();

  if (!cloudAuthEnabled) {
    throw new Error('Cloud authentication is disabled. Enable it in developer settings.');
  }

  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  return supabaseClient;
}

/**
 * Sign up new user
 */
export async function signUp(email, password, metadata = {}) {
  try {
    const client = await getSupabaseClient();
    const {data, error} = await client.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
      },
    });

    if (error) throw error;

    await logAuditEvent('AUTH_SIGNUP', 'User signed up', {email});
    await storeAuthToken(data.session?.access_token);

    return {success: true, user: data.user, session: data.session};
  } catch (error) {
    console.error('Sign up error:', error);
    await logAuditEvent('AUTH_SIGNUP_ERROR', 'Sign up failed', {error: error.message});
    return {success: false, error: error.message};
  }
}

/**
 * Sign in existing user
 */
export async function signIn(email, password) {
  try {
    const client = await getSupabaseClient();
    const {data, error} = await client.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    await logAuditEvent('AUTH_SIGNIN', 'User signed in', {email});
    await storeAuthToken(data.session?.access_token);

    return {success: true, user: data.user, session: data.session};
  } catch (error) {
    console.error('Sign in error:', error);
    await logAuditEvent('AUTH_SIGNIN_ERROR', 'Sign in failed', {error: error.message});
    return {success: false, error: error.message};
  }
}

/**
 * Sign out user
 */
export async function signOut() {
  try {
    const client = await getSupabaseClient();
    const {error} = await client.auth.signOut();

    if (error) throw error;

    await logAuditEvent('AUTH_SIGNOUT', 'User signed out');
    await SecureStore.deleteItemAsync('supabase_token');

    return {success: true};
  } catch (error) {
    console.error('Sign out error:', error);
    return {success: false, error: error.message};
  }
}

/**
 * Get current user
 */
export async function getCurrentUser() {
  try {
    const client = await getSupabaseClient();
    const {data, error} = await client.auth.getUser();

    if (error) throw error;

    return {success: true, user: data.user};
  } catch (error) {
    console.error('Get user error:', error);
    return {success: false, error: error.message};
  }
}

/**
 * Store auth token securely
 */
async function storeAuthToken(token) {
  if (!token) return;
  try {
    await SecureStore.setItemAsync('supabase_token', token);
  } catch (error) {
    console.error('Error storing auth token:', error);
  }
}

/**
 * Get stored auth token
 */
export async function getAuthToken() {
  try {
    return await SecureStore.getItemAsync('supabase_token');
  } catch (error) {
    console.error('Error retrieving auth token:', error);
    return null;
  }
}

/**
 * Check if user has valid session
 */
export async function hasValidSession() {
  try {
    const token = await getAuthToken();
    if (!token) return false;
    
    const cloudAuthEnabled = await isCloudAuthEnabled();
    if (!cloudAuthEnabled) return false;
    
    const client = await getSupabaseClient();
    const {data, error} = await client.auth.getUser();
    
    return !error && data.user;
  } catch (error) {
    console.error('Session check error:', error);
    return false;
  }
}
