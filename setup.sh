#!/usr/bin/env bash
# Campus Connect: one-time setup. Run from the project root.
set -e
npm install
# Native / peer packages: expo install picks the versions matching SDK 57.
npx expo install expo-sqlite react-native-screens react-native-worklets react-native-svg react-native-gesture-handler
npx expo install --fix
npx expo-doctor || true
npx expo lint
npx tsc --noEmit
echo "Setup OK. Start with: npx expo start --clear"
