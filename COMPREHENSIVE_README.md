# G.U.R.U POS - Complete Point of Sale System

A comprehensive, offline-first Point of Sale (POS) application built with React Native and Expo, featuring cloud synchronization, barcode scanning, and complete transaction management.

## 🚀 Features

### ✅ Core Features
- **Offline-First Architecture**: All data stored locally with WatermelonDB
- **Cloud Synchronization**: Two-way delta sync with conflict resolution
- **Barcode Scanning**: Fixed-frame scanner with debounce and auto-add functionality
- **Payment Processing**: Multiple payment modes with customer details
- **Transaction Management**: Complete sales tracking and reporting
- **Receipt Generation**: PDF receipts with absolute file paths
- **Real-time Reports**: Today's sales with detailed analytics
- **JWT Authentication**: Secure cloud authentication with offline verification

### 🛠 Technical Stack
- **Frontend**: React Native with Expo SDK 53
- **Database**: WatermelonDB (SQLite-based)
- **Backend**: Node.js + Express + MongoDB
- **Authentication**: JWT with AsyncStorage
- **Cloud Sync**: Custom delta sync with idempotency
- **UI**: React Native Vector Icons (Ionicons)
- **PDF Generation**: Expo Print
- **Barcode Scanning**: Expo Camera

## 📱 Screenshots

The app includes:
- **Home Screen**: Item catalog with search and cart management
- **Counter Screen**: Transaction processing with quantity controls
- **Payment Mode Screen**: Customer details and payment selection
- **Scanner Screen**: Fixed-frame barcode scanner with scan queue
- **Reports Screen**: Real-time sales analytics and transaction history
- **Settings Screen**: App configuration and cloud sync settings

## 🏗 Project Structure

```
pos-billing-app/
├── src/
│   ├── context/
│   │   └── CartContext.js          # Global cart state management
│   ├── db/
│   │   ├── models/                 # WatermelonDB models
│   │   ├── schema.js              # Database schema
│   │   └── seed-script.js         # Database seeding
│   ├── screens/
│   │   ├── HomeScreen.js          # Main catalog screen
│   │   ├── CounterScreen.js       # Transaction processing
│   │   ├── PaymentModeScreen.js   # Payment selection
│   │   ├── ImprovedScannerScreen.js # Barcode scanner
│   │   ├── ReportsScreen.js       # Sales analytics
│   │   └── PaymentSuccessScreen.js # Payment confirmation
│   ├── services/
│   │   ├── authService.js         # JWT authentication
│   │   ├── deltaSyncService.js    # Cloud synchronization
│   │   ├── transactionService.js  # Payment processing
│   │   └── exportService.js       # PDF/CSV generation
│   └── utils/
│       ├── calculations.js        # Math utilities
│       └── formatters.js          # Currency formatting
├── backend/                       # Express.js API server
├── android/                       # Android build files
└── package.json
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Expo CLI (`npm install -g @expo/cli`)
- Android Studio (for APK builds)
- MongoDB Atlas account (for cloud sync)

### 1. Clone and Install
```bash
git clone <repository-url>
cd pos-billing-app
npm install --legacy-peer-deps
```

### 2. Backend Setup
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your MongoDB connection string
npm start
```

### 3. Frontend Setup
```bash
# In project root
npx expo start
```

### 4. Run on Device
- Install Expo Go app on your phone
- Scan QR code from terminal
- Or run on Android emulator: `npx expo run:android`

## 🔧 Configuration

### Environment Variables
Create `.env` files in both root and backend directories:

**Root .env:**
```
EXPO_PUBLIC_API_URL=http://localhost:3000/api
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
```

**Backend .env:**
```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/guru_pos
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=7d
PORT=3000
```

### Database Setup
1. **Local Database**: Automatically created with WatermelonDB
2. **Cloud Database**: MongoDB Atlas with provided schema
3. **Seeding**: Run `npm run seed` to populate with sample data

## 📱 APK Build Instructions

### 1. Prepare for Production
```bash
# Update app.json with your app details
# Set version, bundle identifier, etc.
```

### 2. Generate Keystore (Android)
```bash
cd android/app
keytool -genkey -v -keystore guru-pos-key.keystore -alias guru-pos -keyalg RSA -keysize 2048 -validity 10000
```

### 3. Configure Signing
Create `android/gradle.properties`:
```properties
MYAPP_RELEASE_STORE_FILE=guru-pos-key.keystore
MYAPP_RELEASE_KEY_ALIAS=guru-pos
MYAPP_RELEASE_STORE_PASSWORD=your_store_password
MYAPP_RELEASE_KEY_PASSWORD=your_key_password
```

### 4. Build APK
```bash
# Development build
npx expo run:android --variant release

# Or create APK directly
cd android
./gradlew assembleRelease
```

### 5. APK Location
The signed APK will be at:
```
android/app/build/outputs/apk/release/app-release.apk
```

## 🔄 Cloud Synchronization

### Features
- **Delta Sync**: Only syncs changed data since last sync
- **Conflict Resolution**: Server wins for conflicts (last-write-wins)
- **Idempotency**: Prevents duplicate transactions
- **Offline Support**: Works completely offline, syncs when online
- **Auto-sync**: Automatically syncs every 30 seconds when online

### Sync Process
1. **Push**: Local changes → Cloud
2. **Pull**: Cloud changes → Local
3. **Merge**: Resolve conflicts using timestamps
4. **Mark Synced**: Update local records as synced

## 🧪 Testing

### Unit Tests
```bash
npm test
```

### E2E Tests (Detox)
```bash
# Setup Detox
npm install -g detox-cli
detox build --configuration android
detox test --configuration android
```

### Test Coverage
- Authentication flows
- Transaction processing
- Inventory management
- Sync operations
- Barcode scanning

## 📊 Reports & Analytics

### Available Reports
- **Today's Sales**: Real-time transaction summary
- **Customer Details**: Customer information and purchase history
- **Payment Methods**: Breakdown by payment type
- **Item Analytics**: Best-selling items and inventory levels
- **Export Options**: PDF receipts and CSV data export

### Export Features
- **PDF Receipts**: Professional receipts with company branding
- **CSV Export**: Transaction data for external analysis
- **Absolute Paths**: Files saved to device with full paths
- **Offline Export**: Works without internet connection

## 🔒 Security Features

- **JWT Authentication**: Secure token-based auth
- **Offline Verification**: Local token validation
- **Data Encryption**: Sensitive data encrypted at rest
- **Row Level Security**: User-specific data isolation
- **Audit Logging**: Complete activity tracking

## 🚀 Deployment

### Production Checklist
- [ ] Update environment variables
- [ ] Configure MongoDB Atlas
- [ ] Set up cloud sync
- [ ] Generate production keystore
- [ ] Test on physical devices
- [ ] Configure app store metadata

### App Store Submission
1. **Google Play Store**:
   - Generate signed APK
   - Create store listing
   - Upload APK to Play Console
   - Submit for review

2. **Huawei AppGallery**:
   - Follow similar process
   - Use Huawei-specific signing

## 🐛 Troubleshooting

### Common Issues

**1. Metro bundler issues:**
```bash
npx expo start --clear
```

**2. Android build failures:**
```bash
cd android
./gradlew clean
npx expo run:android
```

**3. Database migration issues:**
```bash
# Clear database and reinstall
rm -rf node_modules
npm install
npx expo start --clear
```

**4. Sync issues:**
- Check network connectivity
- Verify MongoDB connection
- Check JWT token validity

### Debug Mode
```bash
# Enable debug logging
export EXPO_DEBUG=true
npx expo start
```

## 📈 Performance Optimization

### Implemented Optimizations
- **Lazy Loading**: Screens loaded on demand
- **Image Optimization**: Compressed images and icons
- **Database Indexing**: Optimized queries
- **Memory Management**: Proper cleanup of resources
- **Debounced Scanning**: Prevents duplicate barcode scans

### Monitoring
- **Crash Reporting**: Integrated error tracking
- **Performance Metrics**: App startup and sync times
- **User Analytics**: Feature usage statistics

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the troubleshooting section
- Review the documentation

## 🎯 Roadmap

### Upcoming Features
- [ ] Multi-store support
- [ ] Advanced analytics dashboard
- [ ] Inventory management
- [ ] Customer loyalty program
- [ ] Multi-language support
- [ ] Dark mode theme

---

**Built with ❤️ for small businesses and retailers**
