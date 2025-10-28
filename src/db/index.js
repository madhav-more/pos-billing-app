import {Database} from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import schema from './schema';
import Item from './models/Item';
import Transaction from './models/Transaction';
import TransactionLine from './models/TransactionLine';
import Setting from './models/Setting';
import AuditLog from './models/AuditLog';

// Using LokiJS adapter for compatibility with RN 0.79
// Note: LokiJS is in-memory by default, but we can persist to AsyncStorage
const adapter = new LokiJSAdapter({
  schema,
  useWebWorker: false,
  useIncrementalIndexedDB: true,
  onSetUpError: error => {
    console.error('Database setup error:', error);
  },
});

export const database = new Database({
  adapter,
  modelClasses: [Item, Transaction, TransactionLine, Setting, AuditLog],
});

export {Item, Transaction, TransactionLine, Setting, AuditLog};
