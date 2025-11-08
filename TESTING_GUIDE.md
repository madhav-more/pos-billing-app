# Testing Guide - Scanner & Persistence Fixes

## ✅ Changes Applied

### 1. Barcode Scanner Speed
- **Reduced debounce delay** from 2 seconds → **1 second**
- **Faster scan reset** from 1 second → **500ms**
- Now you can scan items much faster!

### 2. Cart Data Persistence
- **Added AsyncStorage** to CartContext
- Cart automatically saves when you add/remove items
- Cart automatically loads when app reopens
- **Now your cart persists between sessions!**

---

## 🧪 How to Test

### Step 1: Clear Old Data (Important!)
Since we changed the schema and added persistence:

```
Settings → Apps → Expo Go → Storage → Clear Data
```

Or uninstall/reinstall Expo Go.

### Step 2: Restart Development Server

```powershell
npx expo start --clear
```

### Step 3: Test Barcode Scanner

1. **Open the app** and login
2. **Go to Counter** tab
3. **Tap the Scan icon** (camera icon)
4. **Grant camera permission** when prompted
5. **Scan a barcode** (any product with barcode)
6. ✅ Item should add to cart within **1 second**
7. **Scan another barcode** immediately after
8. ✅ Should scan again after **1 second** (not 2!)

**What Changed:**
- Faster response time
- Can scan multiple items quickly
- Less waiting between scans

### Step 4: Test Cart Persistence

1. **Add items to cart** (via scanner or manual add)
2. **Verify items are in cart** (go to Counter tab)
3. **Close the app completely** (swipe away from recents)
4. **Wait 5 seconds**
5. **Reopen the app**
6. **Login again** (if needed)
7. **Go to Counter tab**
8. ✅ **Your cart items should still be there!**

**What to Check:**
- Item names are correct
- Quantities are correct  
- Prices are correct
- Total amount is correct

### Step 5: Test Multiple Sessions

1. **Add 3 items** to cart
2. **Close app**
3. **Reopen app** → Cart should have 3 items
4. **Add 2 more items** (total 5)
5. **Close app**
6. **Reopen app** → Cart should have 5 items
7. **Remove 2 items** (total 3)
8. **Close app**
9. **Reopen app** → Cart should have 3 items

✅ **Cart should persist through all sessions!**

---

## 📸 Share Screenshots

Please share screenshots of:

1. **Barcode scanner screen** (when it opens)
2. **After scanning** (item added to cart)
3. **Any errors** that appear
4. **Cart persistence test** (cart before/after closing app)

This will help me see exactly what's happening and fix any remaining issues!

---

## 🐛 If Issues Persist

### Scanner not opening or black screen
- Check camera permissions in Settings
- Try restarting the app
- Make sure you're on a real device (not simulator)
- Check if other camera apps work

### Scanner scanning but not adding items
- Check console logs for errors
- Verify barcode format is supported
- Try different barcodes
- Share error message screenshot

### Cart not persisting
- Clear app data completely
- Check if AsyncStorage permissions are granted
- Restart app completely (not just minimize)
- Look for console errors about storage

### Still have 2-second delay
- Make sure you cleared Metro bundler cache
- Restart with `npx expo start --clear`
- Check that changes were applied (line 124 should say "1000")

---

## 📝 Next Steps

Once these work:
1. ✅ Test customer save functionality
2. ✅ Test payment flow
3. ✅ Test inventory deduction
4. ✅ Build APK for distribution

---

## 🎯 Expected Behavior

**Scanner:**
- Opens instantly with camera view
- Scans barcode within 1 second
- Auto-adds item to cart
- Ready for next scan in 1 second
- Unknown barcodes show add item modal

**Persistence:**
- Cart saves automatically
- Cart loads on app open
- No data loss when closing app
- Works across app restarts
- Survives phone lock/unlock

**Everything should now work smoothly!** 🚀

If you still see issues, please share the screenshots and I'll debug further.
