# Data Persistence & Sync Issues - Fix Guide

## Issues Fixed

### 1. Database Not Persisting Data ✅
**Problem**: Items, customers, and transactions disappeared after app restart.

**Root Cause**: 
- `useIncrementalIndexedDB: true` was set but this only works for web browsers, not React Native
- Missing filesystem persistence configuration

**Fix Applied**:
- Changed `useIncrementalIndexedDB` to `false`
- Added `persistenceMethod: 'fs'` for React Native filesystem storage
- File modified: `src/db/index.js`

---

### 2. "Backend offline" Warning ✅
**Problem**: Push/Pull items failed with "Backend offline" warning.

**Root Cause**: 
- Hardcoded API URL in `deltaSyncService.js`
- `.env` file not created with proper API URL

**Fix Applied**:
- Created `.env` file with `EXPO_PUBLIC_API_URL=http://localhost:3000/api`
- Updated `deltaSyncService.js` to use environment variable
- Files modified: `src/services/deltaSyncService.js`, `.env` (created)

---

### 3. "Invalid value passed to queue" Error ✅
**Problem**: Query errors when syncing data.

**Root Cause**: 
- Complex WatermelonDB queries with `Q.or()` and `Q.where()` failing on optional fields
- Field name mismatch (`is_synced` vs `isSynced`)

**Fix Applied**:
- Replaced complex queries with simple `fetch()` and JavaScript filter
- Fixed field name consistency (`isSynced` and `syncedAt`)
- File modified: `src/services/deltaSyncService.js`

---

## What You Need To Do Now

### Step 1: Restart the App Completely
1. Stop the Expo dev server (Ctrl+C in terminal)
2. Clear the app data:
   ```bash
   # For iOS Simulator
   xcrun simctl erase all
   
   # For Android Emulator
   adb shell pm clear com.guru.pos
   
   # Or just uninstall and reinstall the app
   ```
3. Restart Expo:
   ```bash
   npx expo start
   ```

### Step 2: Update API URL if Needed
If you're testing on:
- **iOS Simulator**: Use `http://localhost:3000/api` (already set)
- **Android Emulator**: Change to `http://10.0.2.2:3000/api`
- **Physical Device**: Use your computer's IP, e.g., `http://192.168.1.100:3000/api`

Edit `.env` file and update:
```
EXPO_PUBLIC_API_URL=http://YOUR_IP:3000/api
```

### Step 3: Test Data Persistence
1. **Create Items**:
   - Add 2-3 items in the app
   - Close the app completely
   - Reopen the app
   - ✅ Items should still be there

2. **Create Customers**:
   - Add customer with phone number
   - Add customer without phone number (name only)
   - Close and reopen app
   - ✅ Both customers should be saved

3. **Create Transactions**:
   - Add items to cart
   - Enter customer details
   - Complete transaction
   - Go to Reports screen
   - ✅ Transaction should appear
   - Close and reopen app
   - ✅ Transaction should still be in Reports

### Step 4: Test Backend Sync
1. Ensure backend is running on port 3000
2. Create items/customers/transactions in the app
3. Check console logs for sync messages:
   - "📤 Pushing X items..."
   - "✅ Delta sync completed"
4. Verify data appears in MongoDB

---

## Expected Console Logs

### Good Signs ✅
```
Database setup successful
✅ MongoDB connected successfully
Network status: Online
✅ Delta sync completed
📤 Pushing 3 items...
```

### Warnings (Normal) ⚠️
```
WARN  Backend offline (if backend not running - this is OK)
WARN  Collection X not found, skipping (if empty - this is OK)
```

### Bad Signs ❌
```
Database setup error: ...
Migration error: ...
Cannot read property 'collections' of undefined
Push failed: Invalid value passed to queue
```

---

## Files Modified

1. **src/db/index.js**
   - Changed `useIncrementalIndexedDB: false`
   - Added `persistenceMethod: 'fs'`

2. **src/services/deltaSyncService.js**
   - Updated API_BASE_URL to use env variable
   - Fixed query logic to avoid Q.or() errors
   - Fixed field names (isSynced, syncedAt)

3. **.env** (created)
   - Added EXPO_PUBLIC_API_URL configuration

---

## Troubleshooting

### Data Still Not Persisting?
1. Check database location:
   ```javascript
   // Add this to App.js temporarily
   import { database } from './src/db';
   console.log('Database adapter:', database.adapter.schema);
   ```

2. Check if autosave is working:
   ```javascript
   // In db/index.js, add:
   extraOptions: {
     autosave: true,
     autosaveInterval: 1000,
     persistenceMethod: 'fs',
     onSave: () => console.log('💾 Database saved'),
   }
   ```

### Still Getting "Backend offline"?
1. Check backend is actually running:
   ```bash
   curl http://localhost:3000/api/ping
   # Should return: {"status":"ok","timestamp":"..."}
   ```

2. Check your device/emulator can reach the backend:
   - iOS Simulator: `localhost` works
   - Android Emulator: Use `10.0.2.2` instead of `localhost`
   - Physical Device: Use computer's actual IP address

### Sync Errors Continue?
1. The sync warnings are non-critical - data is still saved locally
2. You can disable auto-sync temporarily:
   ```javascript
   // In deltaSyncService.js, comment out:
   // if (this.isOnline && !this.syncInProgress) {
   //   this.performDeltaSync();
   // }
   ```

---

## Testing Checklist

- [ ] Backend running on port 3000
- [ ] `.env` file created with correct API URL
- [ ] App restarted after changes
- [ ] Can create items
- [ ] Items persist after app restart
- [ ] Can create customers (with and without phone)
- [ ] Customers persist after app restart  
- [ ] Can complete transactions
- [ ] Transactions appear in Reports
- [ ] Transactions persist after app restart
- [ ] Customer names show in Reports
- [ ] Backend sync working (if online)
- [ ] No database errors in console

---

## Next Steps After Testing

Once persistence is confirmed working:

1. Test authentication flows (online/offline signup/login)
2. Test all CRUD operations for items, customers, transactions
3. Test sync when going online/offline
4. Deploy backend to production
5. Update API URL in production build

---

## Support

If issues persist after these fixes:
1. Check console logs for exact error messages
2. Verify all files were saved correctly
3. Try clearing app data and reinstalling
4. Check React Native debugger for detailed error stack traces
