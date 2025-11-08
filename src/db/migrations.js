import { schemaMigrations, addColumns } from '@nozbe/watermelondb/Schema/migrations';

export default schemaMigrations({
  migrations: [
    // Migration from version 1 to 2
    {
      toVersion: 2,
      steps: [
        addColumns({
          table: 'items',
          columns: [
            { name: 'is_synced', type: 'boolean', isOptional: true },
            { name: 'synced_at', type: 'string', isOptional: true },
          ],
        }),
      ],
    },
    // Migration from version 2 to 3
    {
      toVersion: 3,
      steps: [
        addColumns({
          table: 'customers',
          columns: [
            { name: 'is_synced', type: 'boolean', isOptional: true },
            { name: 'synced_at', type: 'string', isOptional: true },
          ],
        }),
      ],
    },
    // Migration from version 3 to 4
    {
      toVersion: 4,
      steps: [
        addColumns({
          table: 'transactions',
          columns: [
            { name: 'is_synced', type: 'boolean', isOptional: true },
            { name: 'synced_at', type: 'string', isOptional: true },
          ],
        }),
      ],
    },
    // Migration from version 4 to 5 (added customer fields to transactions)
    {
      toVersion: 5,
      steps: [
        addColumns({
          table: 'transactions',
          columns: [
            { name: 'customer_id', type: 'string', isOptional: true },
            { name: 'customer_name', type: 'string', isOptional: true },
            { name: 'customer_mobile', type: 'string', isOptional: true },
          ],
        }),
      ],
    },
    // Migration from version 5 to 6 (added sync metadata fields, local_id, user_id, and cloud_id)
    {
      toVersion: 6,
      steps: [
        addColumns({
          table: 'items',
          columns: [
            { name: 'local_id', type: 'string', isOptional: true, isIndexed: true },
            { name: 'user_id', type: 'string', isOptional: true, isIndexed: true },
            { name: 'cloud_id', type: 'string', isOptional: true, isIndexed: true },
            { name: 'sync_status', type: 'string', isOptional: true },
            { name: 'sync_error', type: 'string', isOptional: true },
            { name: 'last_sync_attempt', type: 'string', isOptional: true },
            { name: 'idempotency_key', type: 'string', isOptional: true, isIndexed: true },
          ],
        }),
        addColumns({
          table: 'customers',
          columns: [
            { name: 'local_id', type: 'string', isOptional: true, isIndexed: true },
            { name: 'user_id', type: 'string', isOptional: true, isIndexed: true },
            { name: 'cloud_id', type: 'string', isOptional: true, isIndexed: true },
            { name: 'sync_status', type: 'string', isOptional: true },
            { name: 'sync_error', type: 'string', isOptional: true },
            { name: 'last_sync_attempt', type: 'string', isOptional: true },
            { name: 'idempotency_key', type: 'string', isOptional: true, isIndexed: true },
          ],
        }),
        addColumns({
          table: 'transactions',
          columns: [
            { name: 'local_id', type: 'string', isOptional: true, isIndexed: true },
            { name: 'user_id', type: 'string', isOptional: true, isIndexed: true },
            { name: 'cloud_id', type: 'string', isOptional: true, isIndexed: true },
            { name: 'sync_status', type: 'string', isOptional: true },
            { name: 'sync_error', type: 'string', isOptional: true },
            { name: 'last_sync_attempt', type: 'string', isOptional: true },
            { name: 'idempotency_key', type: 'string', isOptional: true, isIndexed: true },
          ],
        }),
        addColumns({
          table: 'transaction_lines',
          columns: [
            { name: 'local_id', type: 'string', isOptional: true, isIndexed: true },
            { name: 'user_id', type: 'string', isOptional: true, isIndexed: true },
            { name: 'cloud_id', type: 'string', isOptional: true, isIndexed: true },
            { name: 'idempotency_key', type: 'string', isOptional: true, isIndexed: true },
          ],
        }),
      ],
    },
    // Migration from version 6 to 7 (added voucher fields and sync queue table)
    {
      toVersion: 7,
      steps: [
        addColumns({
          table: 'transactions',
          columns: [
            { name: 'voucher_number', type: 'string', isOptional: true, isIndexed: true },
            { name: 'provisional_voucher', type: 'string', isOptional: true },
          ],
        }),
      ],
    },
  ],
});
