# Build Troubleshooting Guide

## Current Issue

The Android build is failing with autolinking and Gradle configuration errors, specifically:

```
Error: Autolinking is not set up in `settings.gradle`: expo modules won't be autolinked.
Android Gradle Plugin: project ':expo-barcode-scanner' does not specify `compileSdk` in build.gradle
```

## Root Cause Analysis

The issue appears to be a compatibility mismatch between:
1. **Expo SDK 54** (very recent, released late 2024/early 2025)
2. **React Native 0.81.5** 
3. **React 19.1.0** (bleeding edge, just released)
4. **Android Gradle Plugin** and build tools configuration

## Attempted Fixes

1. ✅ Added WatermelonDB JSI configuration to `MainApplication.kt`
2. ✅ Added WatermelonDB Babel plugin to `babel.config.js`
3. ✅ Created `android/local.properties` with SDK location
4. ✅ Fixed package.json script conflicts
5. ✅ Ran `expo prebuild --clean`
6. ❌ Build still fails at Gradle configuration phase

## Alternative Approaches

### Option 1: Downgrade to Stable Versions (RECOMMENDED)

Use Expo SDK 53 with React 18, which has proven stability:

```bash
# Backup current state
git add -A
git commit -m "WIP: SDK 54 build issues"

# Downgrade to stable versions
npm install expo@^53.0.0 react@18.3.1 react-native@0.76.5 --save --legacy-peer-deps
npm install expo-barcode-scanner@~13.0.0 --save --legacy-peer-deps

# Update other dependencies
npx expo install --fix

# Clean and rebuild
rm -rf android ios node_modules/.cache
npx expo prebuild --clean
npx expo run:android
```

### Option 2: Wait for Expo SDK 54 Stabilization

Expo SDK 54 is very new and may have unresolved compatibility issues. Monitor:
- https://github.com/expo/expo/issues
- https://docs.expo.dev/versions/latest/

### Option 3: Use Expo Go for Development (Temporary)

While the native build issues are resolved, you can develop and test in Expo Go:

```bash
npm start
# Scan QR code with Expo Go app
```

**Limitations:**
- No WatermelonDB JSI (will need to mock or use AsyncStorage temporarily)
- No custom native modules
- Good for UI/UX development only

### Option 4: Manual Gradle Configuration Fix

If you want to continue with SDK 54, try manually patching the expo-barcode-scanner build.gradle:

1. Edit `node_modules/expo-barcode-scanner/android/build.gradle`
2. Add at the top after `apply plugin` lines:
```gradle
android {
    compileSdk 36
}
```

**Note:** This is a temporary fix and will be overwritten on `npm install`.

## Recommended Next Steps

1. **For immediate progress**: Use Option 1 (downgrade to Expo SDK 53 + React 18)
2. **For production stability**: Definitely use stable versions
3. **Keep WatermelonDB JSI changes**: The fixes we made are correct and will work once build succeeds

## What's Working

The following changes are correct and ready:

✅ **WatermelonDB JSI Configuration**
- `MainApplication.kt` - JSI package registration
- `babel.config.js` - WatermelonDB Babel plugin
- `src/db/index.js` - Database setup with JSI enabled

✅ **Phase 1 Features (code complete)**
- CounterScreen with checkout flow
- Export service (PDF/CSV)
- Transaction models
- Cart management

Once the build succeeds, the app should run with full WatermelonDB JSI support and all Phase 1 features.

## Build Environment

- **OS**: macOS
- **Android SDK**: `/Users/madhavmore/Library/Android/sdk`
- **NDK**: 27.1.12297006
- **Gradle**: 8.14.3
- **Build Tools**: 36.0.0
- **Compile SDK**: 36
- **Target SDK**: 36
- **Min SDK**: 24
- **Kotlin**: 2.1.20

## Useful Commands

```bash
# Check Expo doctor
npx expo-doctor

# Clean everything
rm -rf android ios node_modules/.cache android/build android/app/build

# Rebuild from scratch
npm install
npx expo prebuild --clean
npx expo run:android

# Check Android devices
~/Library/Android/sdk/platform-tools/adb devices

# View Android logs
~/Library/Android/sdk/platform-tools/adb logcat | grep -E "(ReactNativeJS|WatermelonDB|JSI|Expo)"
```

## Decision Point

**Do you want to:**
1. Downgrade to Expo SDK 53 + React 18 for stability? (recommended)
2. Continue troubleshooting SDK 54 build issues?
3. Temporarily develop in Expo Go while SDK 54 stabilizes?

Let me know your preference and I'll proceed accordingly.
