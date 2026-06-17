package com.releasehub;

import android.app.Activity;
import com.facebook.react.ReactApplication;
import com.facebook.react.ReactInstanceManager;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.UiThreadUtil;

public class ReleaseHubModule extends ReactContextBaseJavaModule {

    public ReleaseHubModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return "ReleaseHubModule";
    }

    @ReactMethod
    public void reload() {
        UiThreadUtil.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                Activity activity = getCurrentActivity();
                if (activity != null) {
                    try {
                        ReactApplication app = (ReactApplication) activity.getApplication();
                        final ReactInstanceManager manager = app.getReactNativeHost().getReactInstanceManager();
                        manager.recreateReactContextInBackground();
                    } catch (Exception e) {
                        // Fallback: restart the activity if ReactNativeHost is not standard
                        activity.recreate();
                    }
                }
            }
        });
    }
}
