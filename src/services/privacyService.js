import {database} from '../db';

/**
 * Log audit event
 */
export async function logAuditEvent(type, message, meta = {}) {
  try {
    await database.write(async () => {
      const auditLogsCollection = database.collections.get('audit_logs');
      await auditLogsCollection.create(log => {
        log.type = type;
        log.message = message;
        log.meta = JSON.stringify(meta);
      });
    });
  } catch (error) {
    console.error('Error logging audit event:', error);
  }
}

/**
 * Get privacy mode setting
 */
export async function getPrivacyMode() {
  try {
    const settingsCollection = database.collections.get('settings');
    const allSettings = await settingsCollection.query().fetch();
    const setting = allSettings.find(s => s.key === 'privacyMode');
    return setting?.value || 'strict';
  } catch (error) {
    console.error('Error getting privacy mode:', error);
    return 'strict';
  }
}

/**
 * Check if cloud auth is enabled
 */
export async function isCloudAuthEnabled() {
  try {
    const settingsCollection = database.collections.get('settings');
    const allSettings = await settingsCollection.query().fetch();
    const setting = allSettings.find(s => s.key === 'EnableCloudAuth');
    return setting?.value === 'true';
  } catch (error) {
    console.error('Error checking cloud auth status:', error);
    return false;
  }
}

/**
 * Check if developer share is enabled
 */
export async function isDeveloperShareEnabled() {
  try {
    const settingsCollection = database.collections.get('settings');
    const allSettings = await settingsCollection.query().fetch();
    const setting = allSettings.find(s => s.key === 'developerShareToggle');
    return setting?.value === 'true';
  } catch (error) {
    console.error('Error checking developer share status:', error);
    return false;
  }
}

/**
 * Block network request if privacy mode is strict
 */
export function canMakeNetworkRequest(privacyMode, isAuthRequest = false) {
  if (privacyMode === 'strict' && !isAuthRequest) {
    logAuditEvent('BLOCKED_NETWORK_REQUEST', 'Network request blocked by strict privacy mode');
    return false;
  }
  return true;
}
