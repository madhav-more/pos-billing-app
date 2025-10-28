import {Model} from '@nozbe/watermelondb';
import {field, readonly, date} from '@nozbe/watermelondb/decorators';

export default class Item extends Model {
  static table = 'items';

  @field('name') name;
  @field('barcode') barcode;
  @field('sku') sku;
  @field('price') price;
  @field('unit') unit;
  @field('image_path') imagePath;
  @field('category') category;
  @field('recommended') recommended;
  @field('default_quantity') defaultQuantity;
  @readonly @date('created_at') createdAt;
  @readonly @date('updated_at') updatedAt;
}
