import {Model} from '@nozbe/watermelondb';
import {field, readonly, date, children} from '@nozbe/watermelondb/decorators';

export default class Transaction extends Model {
  static table = 'transactions';
  static associations = {
    transaction_lines: {type: 'has_many', foreignKey: 'transaction_id'},
  };

  @field('date') date;
  @field('subtotal') subtotal;
  @field('tax') tax;
  @field('discount') discount;
  @field('other_charges') otherCharges;
  @field('grand_total') grandTotal;
  @field('item_count') itemCount;
  @field('unit_count') unitCount;
  @field('status') status;
  @field('receipt_file_path') receiptFilePath;
  @readonly @date('created_at') createdAt;
  @readonly @date('updated_at') updatedAt;

  @children('transaction_lines') lines;
}
