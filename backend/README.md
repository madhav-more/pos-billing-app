# G.U.R.U POS Backend API

Node.js + Express REST API with Neon Postgres database for the G.U.R.U POS application.

## Features

- **JWT Authentication**: Secure user signup/login with bcrypt password hashing
- **Two-way Delta Sync**: Conflict resolution based on `updated_at` timestamps  
- **Inventory Management**: Automatic inventory deduction on transaction creation
- **Idempotent Operations**: Client-generated UUIDs prevent duplicate records
- **Comprehensive Reports**: Sales analytics with customer and item details
- **Local-first Compatible**: Designed to work with offline-first mobile app

## Prerequisites

- Node.js >= 18.0.0
- Neon Postgres database (or compatible PostgreSQL)

## Quick Start

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment

The `.env` file is already configured with your Neon database. Verify:

```env
DATABASE_URL=postgresql://neondb_owner:npg_...@ep-...neon.tech/neondb?sslmode=require
PORT=3000
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d
NODE_ENV=development
```

**⚠️ IMPORTANT**: Change `JWT_SECRET` in production!

### 3. Run Migrations

```bash
npm run migrate
```

This creates all tables: users, items, customers, transactions, transaction_lines, sync_log.

### 4. Seed Database (Optional)

```bash
npm run seed
```

Creates test user and sample data:
- **Email**: test@example.com
- **Password**: password123
- 4 customers
- 10 items with inventory

### 5. Start Server

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

Server runs on `http://localhost:3000`

### 6. Test Connection

```bash
curl http://localhost:3000/api/ping
```

Expected response:
```json
{"status":"ok","timestamp":"2025-10-28T18:08:06.000Z"}
```

## API Endpoints

### Authentication

#### POST /api/auth/signup
Create new user account.

**Request:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securePassword123",
  "company": "My Store",
  "location": "Mumbai"
}
```

**Response:**
```json
{
  "token": "eyJhbGc...",
  "user": {
    "id": "uuid",
    "name": "John Doe",
    "email": "john@example.com",
    "company": "My Store",
    "location": "Mumbai"
  }
}
```

#### POST /api/auth/login
Login existing user.

**Request:**
```json
{
  "email": "test@example.com",
  "password": "password123"
}
```

**Response:** Same as signup

---

### Items

All endpoints require `Authorization: Bearer <token>` header.

#### GET /api/items?since=<ISO_DATE>
Get all items for authenticated user. Use `since` param for delta sync.

**Response:**
```json
{
  "items": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "name": "Rice (1kg)",
      "barcode": "8901234567891",
      "sku": "RICE-1KG",
      "price": "60.00",
      "unit": "kg",
      "category": "Groceries",
      "inventory_qty": "100.000",
      "recommended": false,
      "created_at": "...",
      "updated_at": "..."
    }
  ]
}
```

#### POST /api/items/batch
Bulk create/update items. Uses upsert with conflict resolution.

**Request:**
```json
{
  "items": [
    {
      "id": "client-generated-uuid",
      "name": "New Item",
      "price": 100.50,
      "unit": "pc",
      "inventory_qty": 50,
      "updated_at": "2025-10-28T12:00:00.000Z"
    }
  ]
}
```

**Response:**
```json
{
  "items": [...],  // Successfully synced items
  "warnings": []   // Items with errors
}
```

#### PUT /api/items/:id
Update single item.

#### DELETE /api/items/:id
Delete item.

---

### Customers

#### GET /api/customers?since=<ISO_DATE>
Get all customers.

#### POST /api/customers/batch
Bulk create/update customers.

**Request:**
```json
{
  "customers": [
    {
      "id": "uuid",
      "name": "Customer Name",
      "phone": "+91 98765 43210",
      "email": "customer@example.com",
      "address": "123 Street, City"
    }
  ]
}
```

#### PUT /api/customers/:id
Update single customer.

---

### Transactions

#### POST /api/transactions/batch
Create transactions with automatic inventory deduction.

**Request:**
```json
{
  "transactions": [
    {
      "id": "uuid",
      "customer_id": "uuid or null",
      "date": "2025-10-28T12:00:00.000Z",
      "subtotal": 100.00,
      "tax": 18.00,
      "discount": 10.00,
      "grand_total": 108.00,
      "item_count": 2,
      "unit_count": 3.5,
      "payment_type": "cash",
      "status": "completed",
      "lines": [
        {
          "id": "uuid",
          "item_id": "uuid",
          "item_name": "Rice (1kg)",
          "quantity": 2,
          "unit_price": 60.00,
          "per_line_discount": 5.00,
          "line_total": 115.00
        }
      ]
    }
  ]
}
```

**Response:**
```json
{
  "transactions": [
    {
      "id": "uuid",
      ...
      "lines": [...],
      "inventory_warnings": [
        {
          "item_id": "uuid",
          "item_name": "Rice (1kg)",
          "new_inventory_qty": "-5.000",
          "warning": "Inventory is now negative"
        }
      ]
    }
  ],
  "warnings": []
}
```

#### GET /api/transactions?from=<ISO>&to=<ISO>&customer_id=<uuid>&payment_type=<type>&status=<status>&since=<ISO>
Query transactions with filters.

---

### Sync

#### POST /api/sync/pull
Pull all changes since timestamp.

**Request:**
```json
{
  "since": "2025-10-28T00:00:00.000Z"
}
```

**Response:**
```json
{
  "items": [...],
  "customers": [...],
  "transactions": [...],
  "server_timestamp": "2025-10-28T18:08:06.123Z"
}
```

#### POST /api/sync/push
Push local changes to server.

**Request:**
```json
{
  "items": [...],
  "customers": [...],
  "transactions": [...]
}
```

**Response:**
```json
{
  "items": {
    "synced": [...],
    "conflicts": [...]  // Server version is newer
  },
  "customers": { ... },
  "transactions": { ... },
  "server_timestamp": "..."
}
```

---

### Reports

#### GET /api/reports/sales?from=<ISO>&to=<ISO>&customer_id=<uuid>&payment_type=<type>
Generate sales report with analytics.

**Response:**
```json
{
  "summary": {
    "total_transactions": 25,
    "total_revenue": 15750.50,
    "total_items_sold": 125,
    "total_discount_given": 250.00,
    "payment_type_breakdown": {
      "cash": { "count": 15, "total": 8500.00 },
      "upi": { "count": 10, "total": 7250.50 }
    }
  },
  "transactions": [
    {
      "id": "uuid",
      "date": "...",
      "grand_total": "500.00",
      "customer_name": "Rajesh Kumar",
      "customer_phone": "+91 98765 43210",
      "company_name": "G.U.R.U Store",
      "items": [
        {
          "item_name": "Rice (1kg)",
          "quantity": 2,
          "unit_price": 60.00,
          "line_total": 120.00
        }
      ]
    }
  ]
}
```

---

## Database Schema

### users
- id (UUID, PK)
- name, email (unique), password_hash
- company, location
- created_at, updated_at

### customers
- id (UUID, PK)
- user_id (FK → users)
- name, phone, email, address
- created_at, updated_at

### items
- id (UUID, PK)
- user_id (FK → users)
- name, barcode, sku
- price (numeric), unit
- inventory_qty (numeric, supports fractional)
- category, recommended
- created_at, updated_at

### transactions
- id (UUID, PK)
- user_id (FK → users)
- customer_id (FK → customers, nullable)
- date, subtotal, tax, discount, other_charges, grand_total
- item_count, unit_count
- payment_type (cash|card|upi|online|credit)
- status (draft|completed|saved_for_later)
- receipt_path
- created_at, updated_at

### transaction_lines
- id (UUID, PK)
- transaction_id (FK → transactions, cascade delete)
- item_id (UUID, nullable)
- item_name, quantity, unit_price, per_line_discount, line_total
- created_at

### sync_log
- id (UUID, PK)
- user_id (FK → users)
- entity_type, entity_id
- change_type (create|update|delete)
- created_at

---

## Conflict Resolution

- **Items & Customers**: Last-write-wins based on `updated_at` timestamp
- **Transactions**: Append-only, idempotent by UUID (duplicates rejected)
- Client receives conflicts in sync response to resolve locally

## Inventory Management

When transactions are created via `/api/transactions/batch`:
1. Transaction and lines inserted atomically (BEGIN/COMMIT)
2. For each line with `item_id`, inventory decremented: `inventory_qty -= quantity`
3. Negative inventory allowed but warning returned
4. Rollback on any error

## Testing

```bash
# Unit tests (coming soon)
npm test

# Run specific test
npm test -- auth.test.js
```

## Deployment

### Environment Variables
Set in production:
- `DATABASE_URL`: Your Neon connection string
- `JWT_SECRET`: Strong random secret (use `openssl rand -base64 32`)
- `JWT_EXPIRES_IN`: Token expiry (e.g., '7d', '30d')
- `PORT`: Server port (default 3000)
- `NODE_ENV`: 'production'

### Deploy to Render/Railway/Fly.io
1. Push code to GitHub
2. Connect repository to hosting platform
3. Set environment variables
4. Deploy
5. Run migration: `npm run migrate`

### Local Production Test
```bash
NODE_ENV=production npm start
```

## Troubleshooting

### Database Connection Failed
- Verify `DATABASE_URL` in `.env`
- Check Neon project is active
- Ensure SSL mode is correct

### JWT Verification Failed
- Token expired (login again)
- Wrong `JWT_SECRET` (regenerate token)

### Inventory Warnings
- Normal for low stock, update inventory via `PUT /api/items/:id`

## License

Private - G.U.R.U POS System
