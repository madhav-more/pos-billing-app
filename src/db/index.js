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

let adapter;
let database;

try {
  adapter = new SQLiteAdapter({
    schema,
    migrations,
    dbName: 'GuruPOS',
    jsi: false, // Disable JSI for better compatibility
    onSetUpError: error => {
      console.error('❌ Database setup error:', error);
      console.error('Error details:', error.message);
    },
  });

  database = new Database({
    adapter,
    modelClasses: [Item, Customer, Transaction, TransactionLine, Setting, AuditLog, SyncQueue],
  });
  
  console.log('✅ Database initialized successfully');
} catch (error) {
  console.error('❌ Fatal database initialization error:', error);
  throw error;
}

export {database, Item, Customer, Transaction, TransactionLine, Setting, AuditLog, SyncQueue};
