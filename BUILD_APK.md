# Building APK for G.U.R.U POS App

This guide will help you build a production-ready APK that can be shared and installed on Android devices.

## Prerequisites ✅

- ✅ EAS CLI installed globally (`npm install -g eas-cli`)
- ✅ Expo account (free) - Create at https://expo.dev
- ✅ `app.json` configured with Android settings
- ✅ `eas.json` configured for APK builds

## Step-by-Step Instructions

### Step 1: Login to Expo

```bash
eas login
```

Enter your Expo credentials. If you don't have an account:
1. Visit https://expo.dev
2. Click "Sign Up"
3. Create free account
4. Return to terminal and login

### Step 2: Configure Project (If needed)

```bash
eas build:configure
```

This will:
- Link your project to Expo
- Create/update `eas.json`
- Set up build profiles

### Step 3: Build APK

#### Option A: Preview Build (For Testing)
```bash
eas build --platform android --profile preview
```

#### Option B: Production Build (For Release)
```bash
eas build --platform android --profile production
```

**What happens:**
- Code is uploaded to Expo servers
- Android build environment is created
- APK is compiled (takes 15-20 minutes)
- Download link is provided

### Step 4: Monitor Build

Watch the build progress in terminal or visit:
```
https://expo.dev/accounts/[your-username]/projects/guru-pos/builds
```

### Step 5: Download APK

Once build completes:
1. Click the download link in terminal
2. Or download from Expo dashboard
3. APK file will be saved (e.g., `guru-pos-1.0.0.apk`)

### Step 6: Share APK

**Share the APK file via:**
- Email
- Google Drive / Dropbox
- WhatsApp / Telegram
- USB transfer

**Users can install by:**
1. Enable "Install from Unknown Sources" in Android Settings
2. Tap the APK file
3. Follow installation prompts

## Build Profiles Explained

### Preview Profile
```json
{
  "distribution": "internal",
  "android": {
    "buildType": "apk"
  }
}
```
- For testing
- Faster builds
- Internal distribution only

### Production Profile
```json
{
  "android": {
    "buildType": "apk",
    "gradleCommand": ":app:assembleRelease"
  }
}
```
- For public release
- Optimized build
- Ready for distribution

## Troubleshooting

### "Not logged in"
```bash
eas logout
eas login
```

### "Project not configured"
```bash
eas build:configure
```

### Build Failed
1. Check `eas.json` format
2. Verify `app.json` has correct package name
3. Review error logs in Expo dashboard

### Slow Build
- Builds take 15-25 minutes (normal)
- EAS uses cloud servers
- Cannot be significantly faster

## Alternative: Local Build

If you prefer building locally:

### Requirements
- Android Studio installed
- Android SDK configured
- Java JDK installed

### Steps
```bash
# Install expo-dev-client
npx expo install expo-dev-client

# Generate native code
npx expo prebuild --platform android

# Build APK
cd android
./gradlew assembleRelease

# APK location:
# android/app/build/outputs/apk/release/app-release.apk
```

## Important Notes

### App Signing
- EAS automatically signs your APK
- For Play Store: Use AAB format instead
  ```bash
  eas build --platform android --profile production
  # Then in eas.json set: "buildType": "aab"
  ```

### Version Management
Update version in `app.json` for each build:
```json
{
  "expo": {
    "version": "1.0.1",  // Increment this
    "android": {
      "versionCode": 2   // Increment this too
    }
  }
}
```

### File Size
- APK size: ~50-80 MB (typical)
- First install may take a few minutes
- Subsequent updates are smaller

## Testing the APK

Before sharing:

1. **Install on your device**
   ```bash
   adb install path/to/your-app.apk
   ```

2. **Test all features:**
   - Login/Authentication
   - Add/Edit items
   - Create transactions
   - View reports
   - Sync with backend

3. **Test offline mode:**
   - Turn off WiFi/Data
   - Use app features
   - Verify local storage works

4. **Test on multiple devices:**
   - Different Android versions
   - Different screen sizes
   - Different manufacturers

## Distribution Checklist

Before sharing APK:
- [ ] Tested on physical device
- [ ] All features working
- [ ] Backend URL configured correctly
- [ ] MongoDB connection working
- [ ] No debug logs in production
- [ ] App icon looks good
- [ ] Splash screen displays correctly
- [ ] Version number updated

## Support

For build issues:
- Check Expo Dashboard: https://expo.dev
- Expo Documentation: https://docs.expo.dev/build/setup/
- Community Forum: https://forums.expo.dev/

---

**Happy Building! 🚀**
