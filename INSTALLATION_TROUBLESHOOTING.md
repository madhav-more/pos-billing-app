# Installation Troubleshooting Guide

## 🔧 Issue: Can't install app on physical phone (SDK 52/53 issues)

### Why This Happens
- Your app uses Expo SDK 53 (latest version)
- Physical devices may need a **development build** (not Expo Go)
- Native modules like WatermelonDB, camera, etc. require custom native code

### ✅ Solution 1: Build Development APK (Recommended)

This creates an installable APK with all native code included:

```bash
# 1. Make sure your phone is connected via USB
adb devices

# 2. Enable USB debugging on your phone
# Settings > Developer Options > USB Debugging

# 3. Clean and rebuild
npx expo start --clear
npx expo run:android --device

# This will:
# - Build the native Android app
# - Install it directly on your phone
# - Start Metro bundler
```

### ✅ Solution 2: Use EAS Build (For Production APK)

```bash
# 1. Install EAS CLI (if not already installed)
npm install -g eas-cli

# 2. Login to Expo account
eas login

# 3. Configure EAS
eas build:configure

# 4. Build APK
eas build --profile development --platform android

# 5. Download and install the APK on your phone
```

### ✅ Solution 3: Fix SDK Version Issues

If you're getting SDK mismatch errors:

```bash
# 1. Check your current SDK version
cat package.json | grep "expo"

# 2. To downgrade to SDK 52 (more stable):
npm install expo@~52.0.0
npx expo install --fix

# 3. Clean everything
rm -rf node_modules android/.gradle android/build
npm install

# 4. Rebuild
npx expo run:android --device
```

### ✅ Solution 4: Quick Local Build

```bash
# 1. Connect phone via USB
# 2. Make sure adb recognizes it
adb devices

# 3. Build and install
cd android
./gradlew clean
cd ..
npx expo run:android --device

# Wait for build to complete (5-10 minutes first time)
```

## 🐛 Common Errors & Fixes

### Error: "SDK version mismatch"
```bash
npx expo install --fix
npx expo start --clear
```

### Error: "Failed to install app"
```bash
# Clear Android build cache
cd android
./gradlew clean
cd ..

# Reinstall dependencies
rm -rf node_modules
npm install

# Try again
npx expo run:android --device
```

### Error: "Device not found"
```bash
# Make sure USB debugging is enabled
adb kill-server
adb start-server
adb devices

# If device shows as "unauthorized":
# Check your phone for USB debugging prompt
# Select "Always allow from this computer"
```

### Error: "Metro bundler won't start"
```bash
# Kill existing Metro process
lsof -ti:8081 | xargs kill -9

# Start fresh
npx expo start --clear
```

### Error: "Gradle build failed"
```bash
# Update Android SDK tools
# Open Android Studio > SDK Manager > Update all

# Or set JAVA_HOME
export JAVA_HOME=/Library/Java/JavaVirtualMachines/jdk-17.jdk/Contents/Home

# Clean and rebuild
cd android
./gradlew clean
./gradlew assembleDebug
cd ..
```

## 📱 Testing Installation

### Step 1: Verify Phone Connection
```bash
adb devices
# Should show your device listed
```

### Step 2: Build & Install
```bash
npx expo run:android --device
```

### Step 3: Watch Logs
```bash
# In another terminal
npx react-native log-android
```

### Step 4: Verify App is Running
- Check if G.U.R.U icon appears in app drawer
- Open the app
- You should see the splash screen then onboarding

## 🎯 Quick Fix Checklist

- [ ] USB debugging enabled on phone
- [ ] Phone connected and authorized (`adb devices`)
- [ ] Android SDK installed (via Android Studio)
- [ ] JAVA_HOME set correctly
- [ ] Node.js 18+ installed
- [ ] Clean build (`npx expo start --clear`)
- [ ] Try building directly (`npx expo run:android --device`)

## 💡 Pro Tips

### Faster Builds
```bash
# Build in release mode (smaller, faster)
cd android
./gradlew assembleRelease
cd ..

# Install the APK
adb install android/app/build/outputs/apk/release/app-release.apk
```

### Debug on Device
```bash
# Enable React DevTools
npx expo start --dev-client

# Shake phone to open developer menu
# Or use: adb shell input keyevent 82
```

### Check App Size
```bash
ls -lh android/app/build/outputs/apk/release/
# Should be around 30-50MB for this app
```

## 🆘 Still Not Working?

### Check System Requirements
- macOS 12.0+ (for iOS)
- Android SDK 31+
- Node.js 18+
- JDK 17+
- At least 8GB RAM free

### Try Alternative Method
```bash
# Use expo prebuild
npx expo prebuild --clean
npx expo run:android --device
```

### Ask for Help
Include this info when asking:
```bash
# System info
node --version
npm --version
npx expo --version

# Phone info
adb devices
adb shell getprop ro.build.version.sdk

# Error logs
npx expo run:android --device 2>&1 | tee build.log
```

## ✅ Success Indicators

You'll know it worked when:
1. Build completes without errors
2. App installs on phone automatically
3. Metro bundler shows "Connected"
4. App opens and shows splash screen
5. You can navigate through the app

## 🎉 Once It Works

Remember:
- Keep Metro bundler running for hot reload
- Shake phone to access developer menu
- Use `npx expo start` for subsequent runs (no rebuild needed)
- Only rebuild when you add new native packages

---

**Need more help?** Check the official docs:
- Expo Dev Client: https://docs.expo.dev/develop/development-builds/introduction/
- React Native Setup: https://reactnative.dev/docs/environment-setup
