import {Model} from '@nozbe/watermelondb';
import {field, date, readonly} from '@nozbe/watermelondb/decorators';

export default class Customer extends Model {
  static table = 'customers';

  @field('local_id') localId;
  @field('cloud_id') cloudId;
  @field('user_id') userId;
  @field('name') name;
  @field('phone') phone;
  @field('email') email;
  @field('address') address;
  @field('is_synced') isSynced;
  @field('synced_at') syncedAt;
  @field('idempotency_key') idempotencyKey;
  @field('sync_status') syncStatus;
  @field('sync_error') syncError;
  @field('last_sync_attempt') lastSyncAttempt;
  @readonly @date('created_at') createdAt;
  @readonly @date('updated_at') updatedAt;
}
