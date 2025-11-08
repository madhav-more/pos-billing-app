# Quick Setup Guide

## ✅ Installation Complete!

Dependencies are installed. You're ready to run the app.

## 🚀 Run the App

### Option 1: Using start script (Recommended)
```bash
npm start
```

### Option 2: Direct Expo command
```bash
ulimit -n 4096  # Fix file watcher limit
npx expo start
```

### Option 3: Platform-specific
```bash
npm run android  # Android emulator
npm run ios      # iOS simulator (macOS only)
```

## 📱 What Happens Next

1. Metro bundler starts
2. QR code appears in terminal
3. Scan QR with Expo Go app (iOS/Android)
4. OR press 'a' for Android, 'i' for iOS emulator

## 🐛 Troubleshooting

### "Too many open files" error
Already fixed in `start.sh`. If you see this error again:
```bash
ulimit -n 4096
npx expo start
```

### Version mismatch warnings
```bash
npx expo install --fix
```

### Clean install
```bash
npm run clean
```

### Can't find module errors
```bash
rm -rf node_modules package-lock.json
npm install
```

## ✅ What's Working Now

- ✅ Full item catalog with search
- ✅ Add to cart (tap +1, long-press +5)
- ✅ Barcode scanner with camera
- ✅ Unknown barcode handler (manual entry)
- ✅ Scan queue
- ✅ Cart state management
- ✅ Sticky total bar

## 🔄 Still TODO (Phase 1)

- Counter/Checkout screen (editable cart, taxes, CHARGE)
- Export engine (PDF/CSV)
- Settings with developer PIN

## 📊 Test Data

Seeded items with barcodes:
- Sugar 1kg: `8901234567890`
- Tea Powder: `8901234567891`
- Biscuit: `8901234567892`
- And 12 more items...

## 🎯 Testing Steps

1. **Start app**: `npm start`
2. **Onboarding**: Create local profile
3. **Add items**: Tap items in catalog
4. **Search**: Type "Sugar" in search bar
5. **Scan**: Tap 📷 icon, scan barcode (or use camera on real device)
6. **Cart**: Check sticky total bar updates
7. **Counter**: Tap total bar to go to checkout

---

**Ready to code!** 🚀
