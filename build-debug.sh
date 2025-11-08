#!/bin/bash

# G.U.R.U POS Development Build Script
# This script builds a debug APK for testing

set -e

echo "🚀 Starting G.U.R.U POS Development Build..."

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

# Navigate to project root
cd "$(dirname "$0")"
print_status "Working directory: $(pwd)"

# Build debug APK
print_status "Building debug APK..."
cd android
./gradlew assembleDebug

# Check if build was successful
if [ -f "app/build/outputs/apk/debug/app-debug.apk" ]; then
    print_status "✅ Debug APK build successful!"
    print_status "APK location: android/app/build/outputs/apk/debug/app-debug.apk"
    
    # Create builds directory if it doesn't exist
    mkdir -p ../builds
    
    # Copy APK to builds directory with timestamp
    TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    cp app/build/outputs/apk/debug/app-debug.apk "../builds/guru-pos-debug-${TIMESTAMP}.apk"
    
    print_status "APK copied to: builds/guru-pos-debug-${TIMESTAMP}.apk"
else
    print_error "❌ Debug APK build failed!"
    exit 1
fi

print_status "🎉 Development build completed successfully!"