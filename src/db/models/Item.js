import {Model} from '@nozbe/watermelondb';
import {field, readonly, date, writer} from '@nozbe/watermelondb/decorators';
import {generateUUID} from '../../utils/uuid';

export default class Item extends Model {
  static table = 'items';

  @field('local_id') localId;
  @field('cloud_id') cloudId;
  @field('user_id') userId;
  @field('name') name;
  @field('barcode') barcode;
  @field('sku') sku;
  @field('price') price;
  @field('unit') unit;
  @field('image_path') imagePath;
  @field('category') category;
  @field('recommended') recommended;
  @field('default_quantity') defaultQuantity;
  @field('inventory_qty') inventoryQty;
  @field('is_synced') isSynced;
  @field('synced_at') syncedAt;
  @field('idempotency_key') idempotencyKey;
  @field('sync_status') syncStatus;
  @field('sync_error') syncError;
  @field('last_sync_attempt') lastSyncAttempt;
  @readonly @date('created_at') createdAt;
  @readonly @date('updated_at') updatedAt;
  
  // Auto-generate UUID on create
  @writer async setDefaults() {
    await this.update(record => {
      if (!record.localId) {
        record.localId = generateUUID();
      }
      if (!record.idempotencyKey) {
        record.idempotencyKey = generateUUID();
      }
      if (record.isSynced === undefined || record.isSynced === null) {
        record.isSynced = false;
      }
      if (!record.syncStatus) {
        record.syncStatus = 'pending';
      }
    });
  }
}
