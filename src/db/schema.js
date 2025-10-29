import {appSchema, tableSchema} from '@nozbe/watermelondb';

export default appSchema({
  version: 3, // Incremented for sync fields
  tables: [
    tableSchema({
      name: 'items',
      columns: [
        {name: 'name', type: 'string'},
        {name: 'barcode', type: 'string', isOptional: true},
        {name: 'sku', type: 'string', isOptional: true},
        {name: 'price', type: 'number'},
        {name: 'unit', type: 'string'},
        {name: 'image_path', type: 'string', isOptional: true},
        {name: 'category', type: 'string', isOptional: true},
        {name: 'recommended', type: 'boolean'},
        {name: 'default_quantity', type: 'number'},
        {name: 'inventory_qty', type: 'number', isOptional: true},
        {name: 'is_synced', type: 'boolean', isOptional: true},
        {name: 'synced_at', type: 'string', isOptional: true},
        {name: 'created_at', type: 'number'},
        {name: 'updated_at', type: 'number'},
      ],
    }),
    tableSchema({
      name: 'customers',
      columns: [
        {name: 'name', type: 'string'},
        {name: 'phone', type: 'string', isOptional: true},
        {name: 'email', type: 'string', isOptional: true},
        {name: 'address', type: 'string', isOptional: true},
        {name: 'is_synced', type: 'boolean', isOptional: true},
        {name: 'synced_at', type: 'string', isOptional: true},
        {name: 'created_at', type: 'number'},
        {name: 'updated_at', type: 'number'},
      ],
    }),
    tableSchema({
      name: 'transactions',
      columns: [
        {name: 'customer_id', type: 'string', isOptional: true},
        {name: 'date', type: 'string'},
        {name: 'subtotal', type: 'number'},
        {name: 'tax', type: 'number'},
        {name: 'discount', type: 'number'},
        {name: 'other_charges', type: 'number'},
        {name: 'grand_total', type: 'number'},
        {name: 'item_count', type: 'number'},
        {name: 'unit_count', type: 'number'},
        {name: 'payment_type', type: 'string', isOptional: true},
        {name: 'status', type: 'string'},
        {name: 'receipt_file_path', type: 'string', isOptional: true},
        {name: 'is_synced', type: 'boolean', isOptional: true},
        {name: 'synced_at', type: 'string', isOptional: true},
        {name: 'created_at', type: 'number'},
        {name: 'updated_at', type: 'number'},
      ],
    }),
    tableSchema({
      name: 'transaction_lines',
      columns: [
        {name: 'transaction_id', type: 'string', isIndexed: true},
        {name: 'item_id', type: 'string', isIndexed: true},
        {name: 'item_name', type: 'string'},
        {name: 'quantity', type: 'number'},
        {name: 'unit_price', type: 'number'},
        {name: 'per_line_discount', type: 'number'},
        {name: 'line_total', type: 'number'},
        {name: 'created_at', type: 'number'},
        {name: 'updated_at', type: 'number'},
      ],
    }),
    tableSchema({
      name: 'settings',
      columns: [
        {name: 'key', type: 'string', isIndexed: true},
        {name: 'value', type: 'string'},
        {name: 'created_at', type: 'number'},
        {name: 'updated_at', type: 'number'},
      ],
    }),
    tableSchema({
      name: 'audit_logs',
      columns: [
        {name: 'type', type: 'string'},
        {name: 'message', type: 'string'},
        {name: 'meta', type: 'string'},
        {name: 'timestamp', type: 'number'},
      ],
    }),
  ],
});
