import {Model} from '@nozbe/watermelondb';
import {field, readonly, date} from '@nozbe/watermelondb/decorators';

export default class AuditLog extends Model {
  static table = 'audit_logs';

  @field('type') type;
  @field('message') message;
  @field('meta') meta;
  @readonly @date('timestamp') timestamp;

  get parsedMeta() {
    try {
      return JSON.parse(this.meta);
    } catch {
      return {};
    }
  }
}
