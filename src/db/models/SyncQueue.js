import {Model} from '@nozbe/watermelondb';
import {field, readonly, date} from '@nozbe/watermelondb/decorators';

export default class SyncQueue extends Model {
  static table = 'sync_queue';

  @field('entity_type') entityType;
  @field('entity_id') entityId;
  @field('operation') operation;
  @field('data') data;
  @field('retry_count') retryCount;
  @field('last_error') lastError;
  @readonly @date('created_at') createdAt;
  @readonly @date('updated_at') updatedAt;
}
