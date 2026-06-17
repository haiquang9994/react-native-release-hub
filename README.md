# react-native-release-hub

Client SDK for **ReleaseHub** - a self-hosted Over-The-Air (OTA) update solution for React Native applications.

## Features
- **Zero-setup check for updates**: Query your custom server for new versions.
- **Background downloading & unzipping**: Smooth updates fetching using `react-native-fs` and `react-native-zip-archive`.
- **Dynamic JS Bridge loading**: Seamlessly loads update bundles on startup.
- **Automatic crash rollback protection**: Automatically detects startup crashes and reverts to the previous stable release.

---

## Installation

### 1. Add the package to your React Native project

```bash
npm install react-native-release-hub
# or
yarn add react-native-release-hub
```
*Note: This automatically adds required peer dependencies `react-native-fs` and `react-native-zip-archive`.*

### 2. Install native dependencies (iOS)

```bash
npx pod-install
```

---

## Native Integration Guide

### iOS Integration

Open your `ios/AppDelegate.mm` (or `AppDelegate.m`) file. Import `ReleaseHub.h` and update your bridge's `sourceURLForBridge:` method:

```objc
#import "ReleaseHub.h"
// ...

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
#if DEBUG
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  // Resolve dynamic bundle URL or fall back to mainBundle
  return [ReleaseHub bundleURL];
#endif
}
```

---

### Android Integration

1. Register the React Package in your `MainApplication` (typically located in `android/app/src/main/java/com/yourpackage/MainApplication.java` or `MainApplication.kt`):

```java
import com.releasehub.ReleaseHubPackage;
// ...

@Override
protected List<ReactPackage> getPackages() {
    List<ReactPackage> packages = new PackageList(this).getPackages();
    packages.add(new ReleaseHubPackage()); // <-- Register ReleaseHub package
    return packages;
}
```

2. Override the JS bundle file location in `ReactNativeHost`:

```java
import com.releasehub.ReleaseHub;
// ...

private final ReactNativeHost mReactNativeHost = new ReactNativeHost(this) {
    // ...

    @Nullable
    @Override
    protected String getJSBundleFile() {
        // Dynamic bundle resolution (loads downloaded OTA update if available)
        return ReleaseHub.getJSBundleFile(getApplicationContext());
    }
};
```

---

## JavaScript/TypeScript Usage

### Initialize and Check for Updates
At the entry point of your React Native application (typically `App.tsx` or `index.js`):

```typescript
import React, { useEffect } from 'react';
import { StyleSheet, Text, View, Button } from 'react-native';
import { ReleaseHub } from 'react-native-release-hub';

const config = {
  appName: 'MyApp',
  deploymentName: 'Staging' as const, // or 'Production'
  serverUrl: 'https://your-release-hub-server.com',
  appVersion: '1.0.0', // Must match your native app binary version
};

export default function App() {
  useEffect(() => {
    // 1. MUST call this immediately on startup to mark the pending update as successfully run.
    // If the app crashes on boot before calling this, the Native SDK will rollback on next restart.
    ReleaseHub.notifyApplicationReady();

    // 2. Perform update check
    checkAndApplyUpdates();
  }, []);

  const checkAndApplyUpdates = async () => {
    const update = await ReleaseHub.checkForUpdate(config);
    
    if (update && update.update) {
      console.log('New update available! Downloading...');
      
      const success = await ReleaseHub.downloadAndInstall(update);
      if (success) {
        console.log('Update installed. Reloading app...');
        // Reload React Native bridge immediately to apply update
        ReleaseHub.reload();
      }
    } else {
      console.log('App is up to date.');
    }
  };

  return (
    <View style={styles.container}>
      <Text>Welcome to ReleaseHub! 🚀</Text>
      <Button title="Check for Updates" onPress={checkAndApplyUpdates} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' }
});
```

---

## License
MIT
