# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Commands

### Development
```bash
yarn start         # Start Metro bundler
yarn dev          # Start Expo development server
yarn android      # Run on Android device/emulator
yarn ios          # Run on iOS (macOS only)
yarn seed         # Seed database with sample items
```

### Testing
```bash
yarn test                # Run all tests with Jest
yarn test --coverage     # Run tests with coverage report
yarn test --watch        # Run tests in watch mode
```

### Code Quality
```bash
yarn lint           # Run ESLint
yarn lint:fix       # Auto-fix ESLint issues
yarn format         # Format code with Prettier
```

### Build
```bash
cd android && ./gradlew assembleRelease                    # Android APK
npx react-native run-ios --configuration Release          # iOS Release
```

## Project Architecture

### Technology Stack
- **Framework**: React Native 0.79 with Expo ~53.0.0
- **Database**: WatermelonDB with LokiJS adapter (in-memory with AsyncStorage persistence)
- **Navigation**: React Navigation (Stack + Bottom Tabs)
- **State**: React Context API (CartContext for cart state)
- **Optional Cloud**: Supabase (disabled by default, opt-in only)

### Privacy-First Philosophy
**Default behavior is 100% local-only.** Cloud features (auth, sync, sharing) are disabled by default and require explicit developer toggle via PIN-protected settings. All cloud actions are logged to `audit_logs` table. When working on features, preserve this privacy-first approach.

### Database Schema (WatermelonDB)

The app uses **WatermelonDB** with LokiJS adapter. Key tables:

- **items**: Product catalog (name, barcode, sku, price, unit, category, image_path)
- **transactions**: Sale records (date, subtotal, tax, discount, grand_total, status)
- **transaction_lines**: Line items linking transactions to items (quantity, unit_price, per_line_discount, line_total)
- **settings**: Key-value store for app config (hasOnboarded, EnableCloudAuth, developerShareToggle, etc.)
- **audit_logs**: Privacy/security event tracking (type, message, meta, timestamp)

**Important**: Items and transactions have a many-to-many relationship through `transaction_lines`. When creating transactions, always create associated `transaction_line` records with proper `transaction_id` and `item_id` foreign keys.

### Data Flow

1. **Cart Management**: `CartContext.js` manages in-memory cart state using React Context
   - Cart lines contain: `{itemId, itemName, quantity, unitPrice, perLineDiscount, lineTotal}`
   - Use `addToCart()`, `updateQuantity()`, `updateLineDiscount()`, `clearCart()`, `getTotals()`
   - Cart is ephemeral and cleared after payment

2. **Transaction Creation**: On payment completion
   - Create `Transaction` record in WatermelonDB with totals
   - Create `TransactionLine` records for each cart line
   - Generate PDF/CSV receipt via `exportService.js`
   - Save receipt to device storage (`Documents/GuruReceipts/`)

3. **Calculations**: All math happens in `utils/calculations.js`
   - Use `round()` for all currency values (2 decimal places)
   - `calculateLineTotal(qty, price, discount)` → line subtotal
   - `calculateTransactionTotals(lines, taxPercent, discount, otherCharges)` → full transaction totals
   - Always use these utilities to avoid floating-point errors

### Screen Navigation Flow

```
SplashScreen → OnboardingScreen → MainTabs (Bottom Nav)
                                       ├─ Today (HomeScreen)
                                       ├─ Counter (CounterScreen) ← Scanner modal
                                       ├─ Items (ItemsScreen)
                                       ├─ Reports (ReportsScreen)
                                       └─ More (SettingsScreen)

CounterScreen → PaymentSuccess → MainTabs (Today)
```

- **CounterScreen**: Primary POS screen with cart, scanner, and payment flow
- **ScannerScreen**: Modal overlay for barcode scanning (camera permissions required)
- **PaymentSuccessScreen**: Shows receipt after transaction, allows export/share
- Use `navigation.navigate('ScreenName')` for transitions

### Key Services

- **exportService.js**: PDF/CSV generation using `expo-print` and `expo-file-system`
  - Exports saved to platform-specific paths (Android: `/sdcard/Documents/GuruReceipts/`, iOS: App Documents)
  - HTML receipt template is inline in `generateReceiptHTML()` function
  
- **privacyService.js**: Audit logging and privacy checks
  - `logAuditEvent(type, message, meta)` for tracking sensitive actions
  - `isCloudAuthEnabled()`, `isDeveloperShareEnabled()` → read from settings table
  - `canMakeNetworkRequest()` → blocks network if privacy mode is strict

- **cloudSyncService.js**: Optional cloud sync (disabled by default)
  - Only functional if `EnableCloudAuth` setting is true
  - Manual sync only, no background sync

### File Structure

```
/src
  /context         # React Context providers (CartContext)
  /db              # WatermelonDB schema, models, seed scripts
    schema.js      # Database schema definition
    index.js       # Database initialization
    /models        # WatermelonDB models (Item, Transaction, TransactionLine, Setting, AuditLog)
  /screens         # React Native screens (one per app screen)
  /services        # Business logic (export, privacy, cloud sync, auth)
  /utils           # Pure functions (calculations, formatters, file utils)
    /__tests__     # Jest unit tests
```

## Development Guidelines

### Working with WatermelonDB

Always wrap database writes in `database.write()`:
```js
await database.write(async () => {
  const collection = database.collections.get('items');
  await collection.create(item => {
    item.name = 'New Item';
    item.price = 100;
  });
});
```

To query with relationships:
```js
const transaction = await transactionsCollection.find(id);
const lines = await transaction.lines.fetch(); // Uses @children decorator
```

### Testing

Tests use Jest with React Native Testing Library. Mocks are configured in `jest.setup.js` for Expo modules (expo-secure-store, expo-file-system, expo-barcode-scanner).

When adding tests:
- Place in `__tests__/` folder next to source file
- Mock WatermelonDB database interactions
- Mock Expo modules if needed (camera, file system, etc.)

### Privacy & Security

When adding features that involve:
- **Network requests**: Check `canMakeNetworkRequest()` first
- **Cloud operations**: Verify `isCloudAuthEnabled()` or `isDeveloperShareEnabled()`
- **Sensitive actions**: Call `logAuditEvent()` to create audit trail
- **File sharing**: Only show share UI if `developerShareToggle` is enabled in settings

### Environment Configuration

Create `.env` file from `.env.example`. Supabase credentials are optional and only needed if enabling cloud auth.

Required Node.js version: >= 18.0.0

### Common Patterns

**Formatting**: Use utilities from `utils/formatters.js`:
- `formatCurrency(amount)` → "$10.50"
- `formatDateTime(date)` → human-readable date/time
- `generateReceiptFilename(id, ext)` → unique filename for exports

**Navigation**: Access via `useNavigation()` hook or `navigation` prop in screens.

**Database access**: Import with `import {database} from '../db'` or `import {database} from './db'` depending on file location.

## Platform-Specific Notes

### iOS
- Requires Xcode 14+, CocoaPods
- Run `cd ios && pod install && cd ..` after dependency changes
- Camera permissions auto-requested when ScannerScreen opens

### Android
- Requires JDK 17, Android SDK
- Camera permissions auto-requested when ScannerScreen opens
- File storage uses `/sdcard/Documents/GuruReceipts/`

## Environment Variables

Accessed via `expo-constants`:
```js
import Constants from 'expo-constants';
const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl;
```

Only `REACT_NATIVE_APP_SUPABASE_URL` and `REACT_NATIVE_APP_SUPABASE_ANON_KEY` are configurable. All other settings are stored in WatermelonDB `settings` table.
