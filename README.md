# G.U.R.U POS - Offline-First Point of Sale System

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Platform](https://img.shields.io/badge/platform-Android-green.svg)
![React Native](https://img.shields.io/badge/React%20Native-0.76.5-61DAFB.svg)
![Expo](https://img.shields.io/badge/Expo-52.0.31-000020.svg)

A modern, offline-first Point of Sale (POS) application built with React Native and Expo, featuring local-first architecture with cloud synchronization capabilities.

## 📋 Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the App](#running-the-app)
- [Building APK](#building-apk)
- [Project Structure](#project-structure)
- [Development Journey](#development-journey)
- [Troubleshooting](#troubleshooting)

## ✨ Features

### Core Functionality
- **Offline-First Architecture**: Fully functional without internet connection
- **Local Authentication**: Simple profile-based authentication without cloud dependency
- **Inventory Management**: Add, edit, delete items with real-time stock tracking
- **Customer Management**: Store and search customer information with autocomplete
- **Transaction Processing**: Support for multiple payment modes (Cash, UPI, Card, Credit)
- **Receipt Generation**: Generate and track voucher numbers
- **Reports & Analytics**: Daily sales reports with detailed breakdowns

### Technical Features
- **Local Database**: WatermelonDB for high-performance local storage
- **Cloud Sync**: MongoDB Atlas integration for data backup and synchronization
- **Barcode Scanning**: Quick item entry with camera-based barcode scanner
- **Real-time Updates**: Reactive data updates across all screens
- **Conflict Resolution**: Last-write-wins strategy for data synchronization
- **Idempotency**: Prevents duplicate data during sync operations

## 🏗️ Architecture

### Technology Stack

#### Frontend (Mobile App)
- **React Native** (0.76.5) - Cross-platform mobile framework
- **Expo** (52.0.31) - Development platform and build tool
- **WatermelonDB** - High-performance local database
- **React Navigation** - Navigation and routing
- **Expo Camera** - Barcode scanning functionality
- **NetInfo** - Network connectivity monitoring

#### Backend (API Server)
- **Node.js** with **Express.js** - REST API server
- **MongoDB Atlas** - Cloud database
- **Mongoose** - MongoDB object modeling

### Data Flow

```
┌─────────────┐
│   Mobile    │
│     App     │
└──────┬──────┘
       │
       ├─────► Local Operations (WatermelonDB)
       │       - Instant CRUD operations
       │       - Offline capability
       │       - Real-time UI updates
       │
       └─────► Cloud Sync (When Online)
               - Push local changes to MongoDB
               - Pull server updates
               - Conflict resolution
```

## 📦 Prerequisites

### Required Software

1. **Node.js** (v18 or higher)
   ```bash
   node --version  # Should be >= 18.0.0
   ```

2. **npm** or **yarn**
   ```bash
   npm --version   # Should be >= 9.0.0
   ```

3. **Git**
   ```bash
   git --version
   ```

4. **Expo CLI** (will be installed in setup)

### Optional Tools
- **Expo Go** app on your phone (for development testing)
- **MongoDB Compass** (for database management)
- **Postman** (for API testing)

## 🚀 Installation

### Step 1: Clone the Repository

```bash
git clone <your-repo-url>
cd pos-billing-app
```

### Step 2: Install Frontend Dependencies

```bash
npm install
```

### Key Dependencies Installed:
- @nozbe/watermelondb - Local database
- @react-navigation/native - Navigation
- expo-camera - Barcode scanning
- @react-native-community/netinfo - Network status

### Step 3: Install Backend Dependencies

```bash
cd backend
npm install
cd ..
```

## ⚙️ Configuration

### 1. Frontend Configuration

Edit `src/config/api.js`:

```javascript
export const API_CONFIG = {
  BASE_URL: 'http://YOUR_IP_ADDRESS:3000/api',  // Change to your IP
  TIMEOUT: 10000,
};
```

**Find your IP address:**
- Windows: `ipconfig`
- macOS/Linux: `ifconfig`

### 2. Backend Configuration

Create `backend/.env`:

```env
MONGODB_URI=your_mongodb_atlas_connection_string
PORT=3000
```

Get MongoDB URI from [MongoDB Atlas](https://www.mongodb.com/cloud/atlas):
1. Create free cluster
2. Click "Connect" → "Connect your application"
3. Copy connection string
4. Replace `<password>` with your database password

## 🎮 Running the App

### Terminal 1: Start Backend

```bash
cd backend
npm start
```

Expected output:
```
🚀 G.U.R.U POS Backend running on port 3000
✅ MongoDB connected successfully
```

### Terminal 2: Start Expo

```bash
npx expo start --clear
```

### Test on Phone:
1. Install **Expo Go** app
2. Scan QR code from terminal
3. Ensure phone and computer on same WiFi

## 📱 Building APK

### Using EAS Build (Recommended)

#### 1. Install EAS CLI
```bash
npm install -g eas-cli
```

#### 2. Login
```bash
eas login
```

#### 3. Build APK
```bash
# For testing
eas build --platform android --profile preview

# For production
eas build --platform android --profile production
```

#### 4. Download APK
- Build takes 15-20 minutes
- Download link appears in terminal
- Or visit: https://expo.dev

### Local Build (Advanced)

```bash
npx expo prebuild --platform android
cd android
./gradlew assembleRelease
```

APK location: `android/app/build/outputs/apk/release/app-release.apk`

## 📁 Project Structure

```
pos-billing-app/
├── src/
│   ├── components/        # Reusable components
│   ├── config/           # API configuration
│   ├── context/          # React Context
│   ├── db/              # WatermelonDB setup
│   │   ├── models/      # Database models
│   │   ├── schema.js    # DB schema
│   │   └── migrations.js
│   ├── screens/         # App screens
│   ├── services/        # Business logic
│   └── utils/           # Helper functions
├── backend/
│   └── src/
│       ├── controllers/ # API controllers
│       ├── models/      # Mongoose models
│       ├── routes/      # API routes
│       └── middleware/  # Auth middleware
├── app.json             # Expo config
├── eas.json             # Build config
└── package.json
```

## 🛠️ Development Journey

### Phase 1: Setup (Day 1)
- ✅ Initialized Expo project
- ✅ Integrated WatermelonDB
- ✅ Created database schema
- ✅ Fixed JSI driver issues

### Phase 2: Core Features (Day 2-3)
- ✅ Built authentication system
- ✅ Item management (CRUD)
- ✅ Customer management
- ✅ Barcode scanning
- ✅ Transaction processing

### Phase 3: UI/UX (Day 4)
- ✅ Navigation setup
- ✅ Gradient UI design
- ✅ Real-time updates
- ✅ Stock indicators
- ✅ Reports screen

### Phase 4: Cloud Sync (Day 5-6)
- ✅ MongoDB Atlas setup
- ✅ Express.js backend
- ✅ Sync service implementation
- ✅ Conflict resolution
- ✅ ObjectId compatibility

### Phase 5: Polish (Day 7)
- ✅ Bug fixes
- ✅ Error handling
- ✅ Performance optimization
- ✅ APK build preparation

### Key Challenges Solved

#### 1. UUID vs MongoDB ObjectId
**Problem**: Type mismatch between frontend and backend
**Solution**: Changed backend to accept String type

#### 2. Readonly Fields
**Problem**: WatermelonDB prevented manual timestamp updates
**Solution**: Let WatermelonDB auto-manage timestamps

#### 3. Network in Expo Go
**Problem**: localhost doesn't work on physical devices
**Solution**: Use computer's IP address

#### 4. VirtualizedList Nesting
**Problem**: FlatList inside ScrollView warnings
**Solution**: Use FlatList's ListHeaderComponent

## 🔧 Troubleshooting

### Metro bundler not starting
```bash
npx expo start --clear
```

### Cannot connect to backend
1. Check backend is running: `cd backend && npm start`
2. Verify IP in `src/config/api.js`
3. Check firewall allows port 3000

### Database migration failed
```bash
# Increase schema version in src/db/schema.js
# Or clear app data and reinstall
```

### Sync conflicts
- Check backend logs
- Verify user_id format
- Ensure valid timestamps

### APK build failing
```bash
npm install -g eas-cli@latest
eas build --clear-cache --platform android
```

## 📝 API Documentation

### Authentication
```
Header: X-User-ID: <uuid>
```

### Endpoints

**Push Changes**
```http
POST /api/sync/push
Content-Type: application/json
X-User-ID: <user-uuid>

Body: { items: [], customers: [], transactions: [] }
```

**Pull Changes**
```http
POST /api/sync/pull
Content-Type: application/json
X-User-ID: <user-uuid>

Body: { since: "2025-01-08T00:00:00.000Z" }
```

## 🎯 Features Roadmap

- [ ] Print receipt functionality
- [ ] Multi-currency support
- [ ] Advanced reports (monthly, yearly)
- [ ] Backup/restore functionality
- [ ] Multi-user support
- [ ] Invoice generation
- [ ] Email receipts

## 📄 License

all copyright right reserved by Madhav More

## 👥 Support

Create an issue on GitHub for questions and bug reports.

---

**Built with ❤️ using React Native & Expo**
