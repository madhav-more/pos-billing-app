import {Model} from '@nozbe/watermelondb';
import {field, date} from '@nozbe/watermelondb/decorators';

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
  @date('created_at') createdAt;
  @date('updated_at') updatedAt;
}
