# Build & Test Instructions

## Prerequisites
Before building, ensure you have:
- Node.js >= 18.0.0
- Android Studio (for Android development)
- Java JDK 17
- Expo CLI

## Step 1: Install Dependencies

First, you need to enable PowerShell script execution for the current session:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

Then install dependencies:

```powershell
npm install
```

## Step 2: Start Development Server

To test the app in development mode:

```powershell
npx expo start
```

Then:
- Press `a` to open in Android emulator/device
- Or scan the QR code with Expo Go app on your physical device

## Step 3: Fix Current Errors

The app currently has schema/model mismatches. These have been fixed in the latest changes. You may need to:

1. Clear app data if you've run the app before:
   - Go to device Settings > Apps > Your App > Storage > Clear Data

2. Or uninstall and reinstall the app

## Step 4: Build Production APK

### Option A: Using EAS Build (Recommended)

1. Install EAS CLI globally:
```powershell
npm install -g eas-cli
```

2. Login to Expo account:
```powershell
eas login
```

3. Configure the build:
```powershell
eas build:configure
```

4. Build for Android:
```powershell
eas build --platform android --profile preview
```

This will create an APK that you can download and share.

### Option B: Local Build (Requires Android Studio Setup)

1. Generate Android project:
```powershell
npx expo prebuild --platform android
```

2. Navigate to Android folder and build:
```powershell
cd android
./gradlew assembleRelease
```

The APK will be at: `android/app/build/outputs/apk/release/app-release.apk`

## Troubleshooting

### "Failed to create item" Error
- This was caused by missing fields in the Item model
- Fixed by adding `inventoryQty`, `isSynced`, and `syncedAt` fields

### "Failed to process payment" Error
- This was caused by missing fields in the Transaction model
- Fixed by adding `customerId`, `paymentType`, `isSynced`, and `syncedAt` fields

### PowerShell Execution Policy Error
- Run: `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`
- Choose 'Y' for Yes

### Metro Bundler Cache Issues
- Run: `npx expo start --clear`

### Database Schema Errors
- Uninstall the app completely from your device
- Clear Metro bundler cache
- Reinstall

## Testing Checklist

Before building the APK, test these features:

- [ ] Login/Signup works
- [ ] Barcode scanner opens and scans
- [ ] Unknown barcodes show "Add New Item" modal
- [ ] Manual item creation works
- [ ] Items appear in scan queue
- [ ] Counter screen shows cart items
- [ ] Payment mode selection works (especially Cash)
- [ ] "Generate Sell" button appears for Cash payment
- [ ] Payment processing completes successfully
- [ ] PDF receipt is generated
- [ ] Success screen appears with correct amount
- [ ] Inventory decrements after sale
- [ ] Customer search/autofill works
- [ ] App syncs when coming back online

## Production Considerations

1. Update `app.json` with your app details:
   - `name`: Your app name
   - `slug`: URL-friendly name
   - `version`: Semantic version
   - `icon`: Path to app icon
   - `package`: com.yourcompany.appname

2. Generate signing key for production:
```powershell
keytool -genkeypair -v -storetype PKCS12 -keystore my-release-key.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000
```

3. Update `android/app/build.gradle` with signing config

4. Build release APK/AAB for Play Store

## Next Steps After Testing

Once all features are tested and working:
1. Run `npm run lint` to check code quality
2. Fix any linting errors
3. Build production APK
4. Share APK file with users
