#!/bin/bash

# Increase file watcher limit on macOS
ulimit -n 4096

# Start Expo
npx expo start
