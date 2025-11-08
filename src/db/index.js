import {Database} from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import schema from './schema';
import migrations from './migrations';
import Item from './models/Item';
import Customer from './models/Customer';
import Transaction from './models/Transaction';
import TransactionLine from './models/TransactionLine';
import Setting from './models/Setting';
import AuditLog from './models/AuditLog';
import SyncQueue from './models/SyncQueue';

const adapter = new SQLiteAdapter({
  schema,
  migrations,
  dbName: 'GuruPOS',
  jsi: true,
  onSetUpError: error => {
    console.error('Database setup error:', error);
  },
});

export const database = new Database({
  adapter,
  modelClasses: [Item, Customer, Transaction, TransactionLine, Setting, AuditLog, SyncQueue],
});

export {Item, Customer, Transaction, TransactionLine, Setting, AuditLog, SyncQueue};
