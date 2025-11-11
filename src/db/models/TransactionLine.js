import {Model} from '@nozbe/watermelondb';
import {field, readonly, date, relation} from '@nozbe/watermelondb/decorators';

export default class TransactionLine extends Model {
  static table = 'transaction_lines';
  static associations = {
    transactions: {type: 'belongs_to', key: 'transaction_id'},
    items: {type: 'belongs_to', key: 'item_id'},
  };

  @field('local_id') localId;
  @field('cloud_id') cloudId;
  @field('user_id') userId;
  @field('transaction_id') transactionId;
  @field('item_id') itemId;
  @field('item_name') itemName;
  @field('quantity') quantity;
  @field('unit_price') unitPrice;
  @field('per_line_discount') perLineDiscount;
  @field('line_total') lineTotal;
  @field('idempotency_key') idempotencyKey;
  @readonly @date('created_at') createdAt;
  @readonly @date('updated_at') updatedAt;

  @relation('transactions', 'transaction_id') transaction;
  @relation('items', 'item_id') item;
}
