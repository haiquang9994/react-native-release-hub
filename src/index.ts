import { NativeModules, Platform } from 'react-native';
import RNFS from 'react-native-fs';
import { unzip } from 'react-native-zip-archive';

const { ReleaseHubModule } = NativeModules;

export interface UpdateInfo {
  update: boolean;
  downloadUrl?: string;
  packageHash?: string;
  isMandatory?: boolean;
  description?: string;
  appVersion?: string;
  packageSize?: number;
}

export interface SDKConfig {
  appName: string;
  deploymentName: 'Staging' | 'Production';
  serverUrl: string;
  appVersion: string; // e.g. "1.0.0" (from native App Version)
}

export interface StatusMetadata {
  currentHash: string | null;
  pendingHash: string | null;
  bundlePath: string | null;
  failedHashes: string[];
}

const BASE_DIR = `${RNFS.DocumentDirectoryPath}/release-hub`;
const STATUS_PATH = `${BASE_DIR}/status.json`;
const PACKAGES_DIR = `${BASE_DIR}/packages`;

// Ensure directories exist
async function ensureDirs() {
  const baseExists = await RNFS.exists(BASE_DIR);
  if (!baseExists) {
    await RNFS.mkdir(BASE_DIR);
  }
  const packagesExists = await RNFS.exists(PACKAGES_DIR);
  if (!packagesExists) {
    await RNFS.mkdir(PACKAGES_DIR);
  }
}

// Read status.json
async function readStatus(): Promise<StatusMetadata> {
  await ensureDirs();
  const exists = await RNFS.exists(STATUS_PATH);
  if (!exists) {
    const initialStatus: StatusMetadata = {
      currentHash: null,
      pendingHash: null,
      bundlePath: null,
      failedHashes: []
    };
    await RNFS.writeFile(STATUS_PATH, JSON.stringify(initialStatus, null, 2), 'utf8');
    return initialStatus;
  }
  try {
    const content = await RNFS.readFile(STATUS_PATH, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error('[ReleaseHub] Error reading status file, resetting:', error);
    const fallbackStatus: StatusMetadata = {
      currentHash: null,
      pendingHash: null,
      bundlePath: null,
      failedHashes: []
    };
    await RNFS.writeFile(STATUS_PATH, JSON.stringify(fallbackStatus, null, 2), 'utf8');
    return fallbackStatus;
  }
}

// Write status.json
async function writeStatus(status: StatusMetadata): Promise<void> {
  await ensureDirs();
  await RNFS.writeFile(STATUS_PATH, JSON.stringify(status, null, 2), 'utf8');
}

export class ReleaseHub {
  /**
   * Check if there's an update available on the server
   */
  static async checkForUpdate(config: SDKConfig): Promise<UpdateInfo | null> {
    try {
      const status = await readStatus();
      const currentHash = status.pendingHash || status.currentHash || '';
      
      let serverUrl = config.serverUrl;
      if (serverUrl.endsWith('/')) {
        serverUrl = serverUrl.slice(0, -1);
      }

      const platform = Platform.OS === 'ios' ? 'ios' : 'android';
      const url = `${serverUrl}/api/check-update?appName=${encodeURIComponent(config.appName)}&platform=${platform}&deploymentName=${config.deploymentName}&appVersion=${encodeURIComponent(config.appVersion)}&packageHash=${encodeURIComponent(currentHash)}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const data = await response.json();
      
      // If server has a new update, check if it has previously failed.
      if (data.updateInfo && data.updateInfo.update) {
        const updateHash = data.updateInfo.packageHash;
        if (status.failedHashes.includes(updateHash)) {
          console.warn(`[ReleaseHub] Update with hash ${updateHash} previously failed and was rolled back. Skipping.`);
          return { update: false };
        }
      }

      return data.updateInfo || { update: false };
    } catch (error) {
      console.error('[ReleaseHub] Check update failed:', error);
      return null;
    }
  }

  /**
   * Download and extract update
   */
  static async downloadAndInstall(updateInfo: UpdateInfo): Promise<boolean> {
    if (!updateInfo.update || !updateInfo.downloadUrl || !updateInfo.packageHash) {
      console.error('[ReleaseHub] Invalid update info provided to downloadAndInstall');
      return false;
    }

    const hash = updateInfo.packageHash;
    const tempZipPath = `${BASE_DIR}/temp_${hash}.zip`;
    const targetExtractPath = `${PACKAGES_DIR}/${hash}`;

    try {
      await ensureDirs();

      // Delete target directory if it already exists (e.g. from partial previous download)
      if (await RNFS.exists(targetExtractPath)) {
        await RNFS.unlink(targetExtractPath);
      }
      await RNFS.mkdir(targetExtractPath);

      // Download ZIP file
      console.log(`[ReleaseHub] Downloading update from: ${updateInfo.downloadUrl}`);
      const downloadResult = await RNFS.downloadFile({
        fromUrl: updateInfo.downloadUrl,
        toFile: tempZipPath
      }).promise;

      if (downloadResult.statusCode !== 200) {
        throw new Error(`Download failed with HTTP status ${downloadResult.statusCode}`);
      }

      // Unzip
      console.log(`[ReleaseHub] Unzipping package to: ${targetExtractPath}`);
      await unzip(tempZipPath, targetExtractPath);

      // Clean up zip file
      await RNFS.unlink(tempZipPath);

      // Verify bundle file exists
      const bundleFileName = Platform.OS === 'ios' ? 'main.jsbundle' : 'index.android.bundle';
      const bundlePath = `${targetExtractPath}/${bundleFileName}`;
      const bundleExists = await RNFS.exists(bundlePath);

      if (!bundleExists) {
        throw new Error(`JS Bundle file "${bundleFileName}" not found in extracted archive`);
      }

      // Update status metadata
      const status = await readStatus();
      status.pendingHash = hash;
      status.bundlePath = bundlePath;
      await writeStatus(status);

      console.log(`[ReleaseHub] Update installed. Pending activation on next restart.`);
      return true;
    } catch (error) {
      console.error('[ReleaseHub] Download and installation failed:', error);
      
      // Clean up
      if (await RNFS.exists(tempZipPath)) {
        try { await RNFS.unlink(tempZipPath); } catch {}
      }
      if (await RNFS.exists(targetExtractPath)) {
        try { await RNFS.unlink(targetExtractPath); } catch {}
      }
      return false;
    }
  }

  /**
   * Mark the current pending update as successfully run.
   * This MUST be called at the start of your JS app (e.g., in App.tsx componentDidMount or useEffect)
   * to prevent rolling back to the previous version.
   */
  static async notifyApplicationReady(): Promise<void> {
    try {
      const status = await readStatus();
      if (status.pendingHash) {
        console.log(`[ReleaseHub] Confirming successful boot of version: ${status.pendingHash}`);
        
        // Remove .booting file if exists
        const bootingFilePath = `${BASE_DIR}/.booting-${status.pendingHash}`;
        if (await RNFS.exists(bootingFilePath)) {
          await RNFS.unlink(bootingFilePath);
        }

        status.currentHash = status.pendingHash;
        status.pendingHash = null;
        await writeStatus(status);
      }
    } catch (error) {
      console.error('[ReleaseHub] Failed to notify application ready:', error);
    }
  }

  /**
   * Reload the React Native bridge immediately to apply updates
   */
  static reload(): void {
    if (ReleaseHubModule && typeof ReleaseHubModule.reload === 'function') {
      ReleaseHubModule.reload();
    } else {
      console.warn('[ReleaseHub] Native ReleaseHubModule.reload not available. Please restart the app manually.');
    }
  }
}
