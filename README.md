# G.U.R.U - Grocery Utility & Record Updater

**Privacy-first, offline-first POS & Billing app for small grocery stores**

[![CI](https://github.com/yourusername/guru-pos/actions/workflows/ci.yml/badge.svg)](https://github.com/yourusername/guru-pos/actions)

## 🔒 Privacy Guarantee

**Default Behavior: 100% Local-Only**

- All data stored locally in WatermelonDB (SQLite)
- No internet connection required
- No telemetry, analytics, or tracking
- No data leaves your device
- Optional database encryption with SQLCipher

**Cloud Features (Opt-In Only)**

Cloud authentication is **disabled by default** and requires explicit developer action:

1. Developer must enable `EnableCloudAuth` in Settings (requires PIN)
2. When enabled, only authentication endpoints are accessible
3. Data sync is a separate toggle (`EnableCloudSync`) - OFF by default
4. All cloud actions are logged to audit logs

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18.0.0
- React Native development environment ([setup guide](https://reactnative.dev/docs/environment-setup))
- For iOS: Xcode 14+, CocoaPods
- For Android: JDK 17, Android SDK

### Installation

```bash
# Clone repository
git clone <repo-url>
cd guru-pos

# Install dependencies
yarn install

# For iOS only
cd ios && pod install && cd ..

# Create .env file (use provided template)
cp .env.example .env
```

### Running the App

```bash
# Start Metro bundler
yarn start

# Run on Android
yarn android

# Run on iOS (macOS only)
yarn ios
```

## 📦 Project Structure

```
/src
  /db               # WatermelonDB schema, models, seeds
  /screens          # React Native screens
  /components       # Reusable UI components
  /services         # Business logic & services
  /utils            # Utility functions (calculations, formatters)
  /tests            # Unit & integration tests
```

## 🧪 Testing

```bash
# Run unit tests
yarn test

# Run tests with coverage
yarn test --coverage

# Run E2E tests (Detox - Android)
yarn detox:build:android
yarn detox:test:android
```

## 🛠️ Development

### Seeding Database

```bash
# Populate database with sample items
yarn seed
```

### Linting & Formatting

```bash
# Run ESLint
yarn lint

# Auto-fix issues
yarn lint:fix

# Format code
yarn format
```

## 📁 Exports & File Storage

All receipts and exports are saved to device storage:

**Android:** `/sdcard/Documents/GuruReceipts/`  
**iOS:** `[App Documents]/GuruReceipts/`

**Export Formats:**
- PDF receipts
- CSV transaction data
- PNG receipt images (optional)

**No Sharing by Default:** Files are saved locally. System share sheets are only shown if `developerShareToggle` is enabled in Settings (requires developer PIN).

## 🔐 Developer Toggles (Advanced)

These features are hidden behind a developer PIN and are **OFF by default**:

### Enable Cloud Authentication

1. Go to Settings → Developer Options
2. Enter developer PIN (set during first access)
3. Toggle `Enable Cloud Auth`
4. Restart app

**Note:** This only enables Supabase authentication. Data stays local unless you also enable sync.

### Enable Cloud Sync

1. Enable Cloud Auth first
2. Go to Settings → Developer Options → Cloud Sync
3. Confirm you understand data will be uploaded
4. Sync is manual - no automatic background sync

### Enable Share Features

1. Go to Settings → Developer Options
2. Toggle `Enable Share`
3. Share buttons will appear in export screens

All developer actions are logged to `audit_logs` table.

## 🔧 Database Encryption (Optional)

To enable SQLite encryption:

1. Install SQLCipher native dependencies:
   ```bash
   # iOS
   cd ios && pod install

   # Android - update build.gradle
   # See docs/ENCRYPTION.md for full guide
   ```

2. Enable in Settings → Security → Use Encrypted DB

3. Set encryption key securely (stored in Keychain)

**Platform Notes:** Full SQLCipher support requires native build configuration. See `docs/ENCRYPTION.md`.

## 🌐 Supabase Setup (Opt-In)

If you want to enable cloud authentication:

### 1. Create Supabase Project

- Go to [supabase.com](https://supabase.com)
- Create new project
- Copy your project URL and anon key

### 2. Configure Environment

Create `.env` file:

```env
REACT_NATIVE_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_NATIVE_APP_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Enable in App

- Go to Settings → Developer Options (enter PIN)
- Toggle `Enable Cloud Auth`
- Users can now sign up/sign in during onboarding

### Privacy Notice for Users

When cloud auth is enabled, the app will show:

> "Cloud authentication stores your email and profile with Supabase. Your transaction data remains local unless you explicitly enable sync."

## 📊 Example Exports

See `/examples/exports/` for sample PDF and CSV receipts.

## 🐛 Troubleshooting

### Camera Permissions

If scanning doesn't work:
1. Check app permissions in device settings
2. Grant camera access
3. Fallback: use manual barcode entry

### Export Errors

If file writes fail:
1. Check storage permissions
2. Ensure device has free space
3. Try alternate export path in Settings

### Migration Issues

If database migration fails:
1. App will create backup in `Documents/GuruBackups/`
2. Migration runs in safe-mode (read-only)
3. Contact support or restore from backup

## 🏗️ Build for Production

```bash
# Android APK
cd android
./gradlew assembleRelease

# iOS Archive (macOS + Xcode)
npx react-native run-ios --configuration Release
```

## 📝 License

MIT License - see LICENSE file

## 🤝 Contributing

See CONTRIBUTING.md for development workflow and PR guidelines.

## 📞 Support

- Issues: GitHub Issues
- Docs: `/docs`
- Email: support@gurupos.com

---

**Remember:** Privacy is not optional. It's the default. 🔒
