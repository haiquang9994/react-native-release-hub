package com.releasehub;

import android.content.Context;
import android.util.Log;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import org.json.JSONArray;
import org.json.JSONObject;

public class ReleaseHub {
    private static final String TAG = "ReleaseHub";

    public static String getJSBundleFile(Context context) {
        File baseDir = new File(context.getFilesDir(), "release-hub");
        File statusFile = new File(baseDir, "status.json");
        
        if (!statusFile.exists()) {
            return null; // Fallback to default asset bundle loaded from APK assets
        }
        
        try {
            String content = readFile(statusFile);
            JSONObject status = new JSONObject(content);
            
            String pendingHash = status.optString("pendingHash", null);
            if ("null".equals(pendingHash)) pendingHash = null;
            
            String currentHash = status.optString("currentHash", null);
            if ("null".equals(currentHash)) currentHash = null;
            
            JSONArray failedHashesArray = status.optJSONArray("failedHashes");
            if (failedHashesArray == null) {
                failedHashesArray = new JSONArray();
            }
            
            if (pendingHash != null && pendingHash.length() > 0) {
                File bootingFile = new File(baseDir, ".booting-" + pendingHash);
                
                if (bootingFile.exists()) {
                    // CRASH DETECTED: Rollback to previous version
                    Log.w(TAG, "App crash detected on previous launch for version " + pendingHash + ". Rolling back.");
                    
                    failedHashesArray.put(pendingHash);
                    status.put("failedHashes", failedHashesArray);
                    status.put("pendingHash", JSONObject.NULL);
                    
                    writeFile(statusFile, status.toString(2));
                    bootingFile.delete();
                    
                    if (currentHash != null && currentHash.length() > 0) {
                        File bundleFile = new File(baseDir, "packages/" + currentHash + "/index.android.bundle");
                        if (bundleFile.exists()) {
                            return bundleFile.getAbsolutePath();
                        }
                    }
                    return null;
                } else {
                    // Normal boot of a pending release. Create lock file.
                    bootingFile.createNewFile();
                    
                    File bundleFile = new File(baseDir, "packages/" + pendingHash + "/index.android.bundle");
                    if (bundleFile.exists()) {
                        return bundleFile.getAbsolutePath();
                    }
                }
            }
            
            if (currentHash != null && currentHash.length() > 0) {
                File bundleFile = new File(baseDir, "packages/" + currentHash + "/index.android.bundle");
                if (bundleFile.exists()) {
                    return bundleFile.getAbsolutePath();
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error resolving bundle path", e);
        }
        
        return null;
    }

    private static String readFile(File file) throws IOException {
        try (FileInputStream fis = new FileInputStream(file)) {
            byte[] data = new byte[(int) file.length()];
            fis.read(data);
            return new String(data, StandardCharsets.UTF_8);
        }
    }

    private static void writeFile(File file, String content) throws IOException {
        try (FileOutputStream fos = new FileOutputStream(file)) {
            fos.write(content.getBytes(StandardCharsets.UTF_8));
        }
    }
}
