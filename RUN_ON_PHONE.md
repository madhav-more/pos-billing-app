# Running G.U.R.U POS App on Your Physical Phone

## Method 1: Using Expo Go (NOT SUPPORTED)

**⚠️ IMPORTANT**: This app **CANNOT** run in Expo Go because it uses:
- WatermelonDB (custom native database)
- expo-camera (native module)
- expo-linear-gradient (native module)
- Custom JSI modules

**You MUST use Method 2 (Development Build) instead.**

Expo Go only supports a limited set of packages. Since this app uses custom native code, you need to build a development build and install it directly on your phone.

---

## Method 2: Development Build (Full Features, Recommended)

This method is needed because we're using:
- WatermelonDB
- expo-camera
- expo-linear-gradient
- Custom native modules

### On Your Phone:
1. **Enable Developer Mode**:
   - Go to Settings → About Phone
   - Tap "Build Number" 7 times
   - Developer options will be enabled

2. **Enable USB Debugging**:
   - Go to Settings → Developer Options
   - Enable "USB Debugging"

3. **Connect your phone to Mac via USB cable**

### On Your Mac:
1. **Check if phone is connected**:
   ```bash
   adb devices
   ```
   You should see your device listed. If not:
   ```bash
   # Install adb if needed
   brew install android-platform-tools
   ```

2. **Build and install the app**:
   ```bash
   cd "/Users/madhavmore/Documents/billing and inventatory/pos-billing-app"
   npx expo run:android
   ```

3. This will:
   - Build the APK
   - Install it on your phone
   - Start the Metro bundler

4. **Keep Metro running**:
   - Don't close the terminal
   - The app will reload when you make changes
   - You can shake your phone to open the developer menu

---

## Method 3: Install APK Directly

If you just want to install and test (without live reload):

1. **Build the APK**:
   ```bash
   cd "/Users/madhavmore/Documents/billing and inventatory/pos-billing-app/android"
   ./gradlew assembleRelease
   ```

2. **Find the APK**:
   ```
   android/app/build/outputs/apk/release/app-release.apk
   ```

3. **Transfer to phone**:
   - Use Google Drive, email, or USB
   - Install the APK on your phone
   - You may need to enable "Install from Unknown Sources"

---

## Testing Barcode Scanner

Once the app is running on your phone:

1. Go to **Today** tab
2. Tap the **📷 Scan Barcode** button
3. Grant camera permissions when prompted
4. Point camera at a barcode
5. The app will scan and add the item (if it exists in your database)

---

## Troubleshooting

### Phone not detected by adb:
```bash
# Restart adb
adb kill-server
adb start-server
adb devices
```

### Build errors:
```bash
# Clean and rebuild
cd android
./gradlew clean
cd ..
npx expo run:android
```

### Metro bundler connection issues:
```bash
# Start with clear cache
npx expo start --clear
```

### Camera not working:
- Make sure you granted camera permissions
- Check Settings → Apps → G.U.R.U → Permissions

---

## Quick Commands Reference

```bash
# Start development server
npx expo start

# Run on connected phone
npx expo run:android

# Check connected devices
adb devices

# Install built APK
adb install android/app/build/outputs/apk/debug/app-debug.apk

# View logs
adb logcat | grep ReactNative
```

---

## Current Build Output Location

After running `npx expo run:android`, your APK is here:
```
/Users/madhavmore/Documents/billing and inventatory/pos-billing-app/android/app/build/outputs/apk/debug/app-debug.apk
```

Size: ~171MB
