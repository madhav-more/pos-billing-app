# Backend Setup & Connection Guide

## Current Local IP Address
**Your computer's IP: `10.113.36.252`**

## Quick Start

### Step 1: Navigate to Backend Folder
```bash
cd ..\pos-billing-backend
```

### Step 2: Install Dependencies (if not done)
```bash
npm install
```

### Step 3: Create `.env` file
Create a `.env` file in the backend folder with:

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/pos-billing
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
NODE_ENV=development
```

### Step 4: Start MongoDB

**Option A: If MongoDB is installed locally**
```bash
# Open a new terminal as Administrator
net start MongoDB
```

**Option B: Using Docker (recommended)**
```bash
docker run -d --name mongodb -p 27017:27017 mongo:latest
```

**Option C: Use MongoDB Atlas (cloud)**
1. Go to https://www.mongodb.com/cloud/atlas
2. Create a free cluster
3. Get connection string
4. Update `MONGODB_URI` in `.env` file

### Step 5: Start Backend Server
```bash
# In the backend folder
npm start
```

You should see:
```
✅ MongoDB connected
🚀 Server running on port 3000
```

### Step 6: Update App API URLs

Update the following files with your local IP address:

#### File 1: `src/services/deltaSyncService.js`
```js
// Line 6: Change from
const API_BASE_URL = 'http://localhost:3000/api';

// To
const API_BASE_URL = 'http://10.113.36.252:3000/api';
```

#### File 2: `src/services/authService.js`
```js
// Line 6: Change from
const API_BASE_URL = 'http://localhost:3000/api';

// To
const API_BASE_URL = 'http://10.113.36.252:3000/api';
```

#### File 3: `src/services/jwtAuthService.js`
```js
// Line 3: Change from
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

// To
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.113.36.252:3000/api';
```

### Step 7: Clear App Data & Restart

Since we updated the database schema (added customer fields), you need to:

**Option A: Clear Expo cache and restart**
```bash
npx expo start --clear
```

**Option B: Uninstall and reinstall Expo Go app**
1. On your phone, uninstall Expo Go app
2. Reinstall from Play Store/App Store
3. Run `npx expo start`

## Testing Backend Connection

### 1. Test from Browser
Open in your browser:
```
http://10.113.36.252:3000/api/health
```

You should see:
```json
{"status":"ok"}
```

### 2. Test from App
1. Sign up with a new account
2. Add items via barcode scanner
3. Complete a sale
4. Check Reports screen - should show transaction with customer name
5. Check backend MongoDB - data should be synced

## Backend API Endpoints

### Authentication
- `POST /api/auth/signup` - Create new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/verify` - Verify JWT token

### Items
- `GET /api/items` - Get all items
- `POST /api/items` - Create new item
- `PUT /api/items/:id` - Update item
- `DELETE /api/items/:id` - Delete item
- `POST /api/items/batch` - Bulk create/update items

### Customers
- `GET /api/customers` - Get all customers
- `POST /api/customers` - Create customer
- `PUT /api/customers/:id` - Update customer
- `GET /api/customers/search?q=query` - Search customers

### Transactions
- `GET /api/transactions` - Get all transactions
- `POST /api/transactions` - Create transaction
- `GET /api/transactions/:id` - Get transaction by ID
- `POST /api/transactions/batch` - Bulk create transactions

### Sync
- `POST /api/sync/pull` - Pull changes since last sync
- `POST /api/sync/push` - Push local changes to server

## Troubleshooting

### Backend Not Starting

**Issue: MongoDB connection failed**
```
Solution: Make sure MongoDB is running
- Check: net start MongoDB (Windows)
- Or start Docker container
- Or use MongoDB Atlas
```

**Issue: Port 3000 already in use**
```
Solution: Change PORT in .env file to 3001
Then update API URLs in app to use :3001
```

### App Cannot Connect to Backend

**Issue: Network request failed**
```
Solution 1: Check both devices on same Wi-Fi
- Your computer and phone must be on same network
- Check phone Wi-Fi settings

Solution 2: Check Windows Firewall
- Allow Node.js through Windows Firewall
- Allow port 3000 inbound connections

Solution 3: Update IP address
- Run `ipconfig` again
- IP might change if you reconnect to Wi-Fi
- Update all 3 service files with new IP
```

**Issue: ERR_CONNECTION_REFUSED**
```
Solution: Backend not running
- Go to backend folder
- Run `npm start`
- Wait for "Server running on port 3000" message
```

### App Shows Old Data

**Issue: Schema migration not applied**
```
Solution: Clear app data
1. Uninstall Expo Go app completely
2. Reinstall Expo Go
3. Run `npx expo start --clear`
4. Open app in Expo Go
```

## Database Schema Versions

Current schema version: **5**

### Version History
- **v1**: Initial schema
- **v2**: Added inventory fields
- **v3**: Added sync fields
- **v4**: Added user_id to customers
- **v5**: Added customer_name and customer_mobile to transactions

## Data Flow

### Offline-First Architecture

1. **App Opens**
   - Load data from local WatermelonDB
   - Initialize sync manager
   - Check backend connectivity

2. **User Actions (Scan, Add Item, Complete Sale)**
   - Save to local database immediately
   - Mark as `is_synced = false`
   - Continue working offline

3. **Background Sync (when online)**
   - Push unsynced local changes to backend
   - Pull new changes from backend
   - Mark synced items as `is_synced = true`

4. **Conflict Resolution**
   - Server timestamp wins
   - If server record newer → update local
   - If local record newer → push to server

## Monitoring

### Check Sync Status
```js
// In app console
import deltaSyncService from './src/services/deltaSyncService';
console.log(deltaSyncService.getSyncStatus());
```

### View Unsynced Records
```js
// In app
const items = await database.collections.get('items')
  .query(Q.where('is_synced', false))
  .fetch();
console.log('Unsynced items:', items.length);
```

## Production Deployment

When deploying to production:

1. **Update API URLs to production domain**
```js
const API_BASE_URL = 'https://your-domain.com/api';
```

2. **Use environment variables**
```bash
# In app.json or .env
EXPO_PUBLIC_API_URL=https://your-domain.com/api
```

3. **Secure MongoDB**
- Use MongoDB Atlas
- Enable authentication
- Use SSL/TLS
- Whitelist IP addresses

4. **Secure JWT**
- Use strong JWT_SECRET
- Short expiry times
- Implement token refresh

5. **Deploy Backend**
- Heroku
- AWS EC2
- DigitalOcean
- Vercel (for serverless)

## Support & Help

If you encounter issues:

1. Check console logs in both app and backend
2. Verify IP address hasn't changed
3. Ensure both devices on same network
4. Check Windows Firewall settings
5. Try restarting backend server
6. Clear app cache and restart

## Success Checklist

- [ ] MongoDB running
- [ ] Backend server running on port 3000
- [ ] Browser can access `http://10.113.36.252:3000/api/health`
- [ ] Updated 3 service files with correct IP
- [ ] Cleared app cache (`npx expo start --clear`)
- [ ] App showing "Sync Manager initialized" in console
- [ ] Can create account and login
- [ ] Can scan barcodes and add items
- [ ] Can complete sales
- [ ] Reports show transactions with customer names
- [ ] Check MongoDB - data is syncing

## Current Features Implemented

✅ **Scanner**
- No delay barcode scanning
- Instant item detection
- Loading state for camera
- Manual entry for unknown barcodes

✅ **Reports**
- Show today's transactions
- Customer name displayed
- Expandable item details
- Payment method shown
- Real-time updates

✅ **Customer Management**
- Search by name or phone
- Auto-complete suggestions
- Save customer details
- Link to transactions

✅ **Data Persistence**
- Redux persist for cart state
- WatermelonDB for all data
- Survives app restarts
- AsyncStorage for auth tokens

✅ **Backend Sync**
- Offline-first architecture
- Automatic background sync
- Conflict resolution
- Batch operations

Happy coding! 🚀
