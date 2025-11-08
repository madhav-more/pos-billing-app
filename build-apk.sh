#!/bin/bash

# G.U.R.U POS APK Build Script
# This script builds the APK for the G.U.R.U POS application

set -e

echo "🚀 Starting G.U.R.U POS APK Build Process..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install npm first."
    exit 1
fi

# Navigate to project root
cd "$(dirname "$0")"
print_status "Working directory: $(pwd)"

# Install dependencies
print_status "Installing dependencies..."
npm install --legacy-peer-deps

# Clean previous builds
print_status "Cleaning previous builds..."
rm -rf android/app/build
rm -rf android/build

# Build the APK
print_status "Building APK..."
cd android
./gradlew assembleRelease

# Check if build was successful
if [ -f "app/build/outputs/apk/release/app-release.apk" ]; then
    print_status "✅ APK build successful!"
    print_status "APK location: android/app/build/outputs/apk/release/app-release.apk"
    
    # Create builds directory if it doesn't exist
    mkdir -p ../builds
    
    # Copy APK to builds directory with timestamp
    TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    cp app/build/outputs/apk/release/app-release.apk "../builds/guru-pos-v1.0.0-${TIMESTAMP}.apk"
    
    print_status "APK copied to: builds/guru-pos-v1.0.0-${TIMESTAMP}.apk"
else
    print_error "❌ APK build failed!"
    exit 1
fi

print_status "🎉 Build process completed successfully!"
print_status "You can now install the APK on your Android device."