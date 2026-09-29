# 📱 FestOS Zenith Mobile App (Capacitor Native Android)

This repository includes a full native Android package configured with **Capacitor 8**.

---

## 🚀 Quick Start Commands

All mobile commands can be run directly from the project root:

### 1. Synchronize Web Assets & Plugins
Whenever you make updates to HTML, CSS, or JS files, sync them to the native app with:
```bash
npm run cap:sync
```

### 2. Open Project in Android Studio
To view, debug, or build signed production APK/AAB in Android Studio:
```bash
npm run cap:android
# or
npx cap open android
```

### 3. Direct APK Build via Gradle
To compile a debug APK directly from terminal without opening Android Studio (requires Java 17+ and Android SDK / command line tools installed):
```bash
npm run build:apk
```
The compiled APK will be output to:
`android/app/build/outputs/apk/debug/app-debug.apk`

---

## 🛠 Features & Native Capabilities Integrated

1. **Hardware Back Button Handling**:
   - Automatically closes active bottom sheets, modal overlays, dialogs, and search bars.
   - Graceful backward navigation.

2. **Native Status Bar & Theme**:
   - Auto-styled dark/light transparent overlay matching the FestOS glass UI.

3. **Haptic Feedback**:
   - Vibration pulses on button clicks, tab selections, and QR scanning.

4. **Camera Scanner Permissions**:
   - `android.permission.CAMERA` integrated for instant ID & participant badge scanning.

---

## 📁 Native Project Structure
- `capacitor.config.json` - Capacitor configuration (App ID: `com.festos.zenithfest`, WebDir: `www`)
- `mobile-native.js` - Native bridge controller (Status Bar, Back Button, Haptics)
- `scripts/prepare-www.js` - Asset bundler script
- `android/` - Full Android Studio native project
