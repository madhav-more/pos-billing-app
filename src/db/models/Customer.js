import {Model} from '@nozbe/watermelondb';
import {field, date} from '@nozbe/watermelondb/decorators';

export default class Customer extends Model {
  static table = 'customers';

  @field('name') name;
  @field('phone') phone;
  @field('email') email;
  @field('address') address;
  @field('is_synced') is_synced;
  @field('server_id') server_id;
  @date('created_at') createdAt;
  @date('updated_at') updatedAt;
}
