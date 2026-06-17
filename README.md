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

Open your iOS project files to configure bundle loading.

#### Option A: For Objective-C++ (`AppDelegate.mm` or `AppDelegate.m`)

Import `ReleaseHub.h` and update your bridge's `sourceURLForBridge:` method (or `bundleURL` method depending on React Native version):

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

#### Option B: For Swift (`AppDelegate.swift`)

Import `react_native_release_hub` and update the `bundleURL()` method:

```swift
import react_native_release_hub
// ...

override func bundleURL() -> URL? {
#if DEBUG
  return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
  // Resolve dynamic bundle URL or fall back to mainBundle
  return ReleaseHub.bundleURL()
#endif
}
```
*Note: If your project does not use modular headers, add `#import "ReleaseHub.h"` to your app's Bridging Header file instead of using `import react_native_release_hub`.*

---

Open your Android project files to configure bundle loading.

#### Option A: For Java / ReactNativeHost (Older React Native versions)

1. Register the React Package in your `MainApplication.java`:

```java
import com.releasehub.ReleaseHubPackage;
// ...

@Override
protected List<ReactPackage> getPackages() {
    List<ReactPackage> packages = new PackageList(this).getPackages();
    packages.add(new ReleaseHubPackage()); // <-- Register Package
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

#### Option B: For Kotlin / ReactHost (React Native 0.73+)

If your project is using modern React Native with Kotlin (`MainApplication.kt`), import `ReleaseHub` and pass the bundle file path to `getDefaultReactHost`:

```kotlin
import com.releasehub.ReleaseHub
// ...

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here
        },
      jsBundleFilePath = ReleaseHub.getJSBundleFile(applicationContext), // <-- Pass ReleaseHub bundle path
    )
  }

  // ...
}
```
*Note: Because of autolinking, the `ReleaseHubPackage` is registered automatically and does not need to be added manually to `PackageList`.*

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
