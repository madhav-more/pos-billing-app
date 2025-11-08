# Cloud Sync Setup Guide

## ✅ What's Been Implemented

### 1. **Persistent Login**
- Users stay logged in after closing the app
- Session is stored securely in device storage
- Auto-sync happens on app start if user is authenticated

### 2. **Automatic Cloud Sync**
- **Items**: Synced automatically when created/updated
- **Transactions/Sales**: Synced automatically after payment
- **Reports**: Show real-time data from local DB (synced to cloud)

### 3. **Logout Flow**
- Logout button in Settings screen
- Clears session and redirects to signup/signin page
- User data is preserved locally

### 4. **App Logo**
- Icon and splash screen configured in `app.json`
- Uses existing assets in `/assets` folder

## 🚀 Setup Instructions

### Step 1: Set Up Supabase Database

1. Go to your Supabase project: https://app.supabase.com/project/qkfvufijxgcvjjkwlbpc

2. Click on **SQL Editor** in the left sidebar

3. Click **New Query**

4. Copy the contents of `supabase_schema.sql` file and paste it

5. Click **Run** to execute the SQL

6. Verify tables were created:
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN ('items', 'transactions');
   ```

### Step 2: Enable Email Auth (if not already enabled)

1. Go to **Authentication** > **Providers** in Supabase
2. Make sure **Email** provider is enabled
3. You can disable email confirmation for testing:
   - Go to **Authentication** > **Settings**
   - Toggle off "Enable email confirmations"

### Step 3: Test the App

#### On Emulator/Simulator:
```bash
npx expo start
# Press 'a' for Android or 'i' for iOS
```

#### On Physical Device:
```bash
# Build development APK
eas build --profile development --platform android

# OR use the quick method in RUN_ON_PHONE.md
npx expo run:android
```

### Step 4: Test Cloud Sync

1. **Sign Up**: Create a new account on the app
2. **Add Items**: Go to Items screen, add a few items
3. **Create Sale**: Add items to cart and complete a transaction
4. **Verify in Supabase**: 
   - Go to Supabase > Table Editor
   - Check `items` and `transactions` tables
   - You should see your data!

5. **Test Persistence**: 
   - Close the app completely
   - Reopen it
   - You should still be logged in
   - All your data should be there

6. **Test Logout**:
   - Go to Settings/More tab
   - Tap "Logout"
   - You should be redirected to signup/signin screen

## 📱 How It Works

### When User Signs Up/In:
1. User credentials sent to Supabase
2. Auth token stored securely on device
3. User marked as "onboarded" in local DB
4. Auto-sync starts in background

### When User Creates Item:
1. Item saved to local WatermelonDB
2. Sync service automatically uploads to Supabase
3. User ID attached to item (via RLS trigger)
4. Item now accessible from cloud

### When User Completes Sale:
1. Transaction saved to local DB
2. PDF receipt generated
3. Transaction synced to Supabase in background
4. Visible in Reports screen

### When App Restarts:
1. Check if auth token exists
2. If yes, auto-login user
3. Run auto-sync to push any pending changes
4. Show main app (no need to login again)

## 🐛 Troubleshooting

### "Network request failed" error
- Make sure you're connected to internet
- Check if Supabase URL is correct in `.env`
- Verify Supabase project is active (not paused)

### Items/Transactions not syncing
- Check console logs for sync errors
- Verify SQL schema was created correctly
- Make sure RLS policies are enabled
- Check that user is authenticated (has token)

### App won't install on phone
- Make sure SDK versions match (use SDK 51 or 52)
- Try clearing cache: `npx expo start --clear`
- Rebuild: `npx expo run:android --device`

### Logout not working
- Make sure `onLogout` prop is passed to SettingsScreen
- Check App.js has `handleLogout` function
- Verify navigation is properly configured

## 📊 Monitoring Sync Status

Check the console logs for sync messages:
```
Starting auto-sync...
Items synced to cloud: 10
Transactions synced to cloud: 5
Auto-sync completed
```

Or check for errors:
```
Cloud auth disabled, skipping sync
Not authenticated, skipping auto-sync
Error syncing items: [error message]
```

## 🔐 Security Notes

- All data is protected by Row Level Security (RLS)
- Users can only access their own items and transactions
- Auth tokens stored in secure device storage
- User passwords never stored locally (handled by Supabase)

## 📝 Next Steps

### Optional Enhancements:
1. Add pull-to-refresh to sync data manually
2. Show sync status indicator in UI
3. Add conflict resolution for offline edits
4. Implement real-time subscriptions for multi-device sync
5. Add backup/restore functionality

## ✅ Checklist

- [x] Cloud auth enabled by default
- [x] Persistent login implemented
- [x] Auto-sync on app start
- [x] Items sync when created/updated
- [x] Transactions sync after payment
- [x] Logout redirects to signin
- [x] App logo configured
- [x] Supabase schema provided
- [x] RLS policies configured
- [ ] Supabase database set up (you need to run SQL)
- [ ] Test on physical device

## 🎉 You're Ready!

The app is now fully configured for cloud sync. Just follow the setup instructions above to get everything running!
