#!/bin/bash

# G.U.R.U POS - Android APK Build Script
# This script builds a signed production APK for deployment

echo "🏗️  Starting G.U.R.U POS Android Build..."
echo "=========================================="

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: package.json not found. Please run this script from the project root.${NC}"
    exit 1
fi

# Check for required environment variables
if [ -z "$EXPO_PUBLIC_API_URL" ]; then
    echo -e "${YELLOW}⚠️  Warning: EXPO_PUBLIC_API_URL not set. Using default localhost.${NC}"
    export EXPO_PUBLIC_API_URL="http://localhost:3000/api"
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf android/app/build
rm -rf .expo

# Build the Android app
echo "🔨 Building Android APK..."
echo "This may take several minutes..."

# Use EAS Build for production
echo "Using Expo EAS Build..."

# Check if EAS CLI is installed
if ! command -v eas &> /dev/null; then
    echo "📥 Installing EAS CLI..."
    npm install -g eas-cli
fi

# Check if user is logged in to Expo
echo "Checking Expo authentication..."
if ! eas whoami &> /dev/null; then
    echo "Please login to your Expo account:"
    eas login
fi

# Configure EAS Build if not already configured
if [ ! -f "eas.json" ]; then
    echo "⚙️  Configuring EAS Build..."
    eas build:configure
fi

# Build for Android
echo "🚀 Starting build process..."
echo "Build type: production APK"
eas build --platform android --profile production

echo ""
echo -e "${GREEN}✅ Build process completed!${NC}"
echo "Your APK will be available in the Expo dashboard once the build finishes."
echo "You can check the build status at: https://expo.dev"
echo ""
echo "To download the APK:"
echo "1. Visit https://expo.dev"
echo "2. Go to your project builds"
echo "3. Download the APK file"
echo ""
echo "=========================================="
echo "Build script finished successfully! 🎉"
