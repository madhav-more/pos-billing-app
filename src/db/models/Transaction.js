import {Model} from '@nozbe/watermelondb';
import {field, readonly, date, children} from '@nozbe/watermelondb/decorators';

export default class Transaction extends Model {
  static table = 'transactions';
  static associations = {
    transaction_lines: {type: 'has_many', foreignKey: 'transaction_id'},
  };

  @field('local_id') localId;
  @field('cloud_id') cloudId;
  @field('user_id') userId;
  @field('voucher_number') voucherNumber;
  @field('provisional_voucher') provisionalVoucher;
  @field('customer_id') customerId;
  @field('customer_name') customerName;
  @field('customer_mobile') customerMobile;
  @field('date') date;
  @field('subtotal') subtotal;
  @field('tax') tax;
  @field('discount') discount;
  @field('other_charges') otherCharges;
  @field('grand_total') grandTotal;
  @field('item_count') itemCount;
  @field('unit_count') unitCount;
  @field('payment_type') paymentType;
  @field('status') status;
  @field('receipt_file_path') receiptFilePath;
  @field('is_synced') isSynced;
  @field('synced_at') syncedAt;
  @field('idempotency_key') idempotencyKey;
  @readonly @date('created_at') createdAt;
  @readonly @date('updated_at') updatedAt;

  @children('transaction_lines') lines;
}
