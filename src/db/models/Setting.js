import {Model} from '@nozbe/watermelondb';
import {field, readonly, date} from '@nozbe/watermelondb/decorators';

export default class Setting extends Model {
  static table = 'settings';

  @field('key') key;
  @field('value') value;
  @readonly @date('created_at') createdAt;
  @readonly @date('updated_at') updatedAt;
}
