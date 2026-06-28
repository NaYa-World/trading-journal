import { GoogleSignIn } from "@capawesome/capacitor-google-sign-in";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Capacitor } from "@capacitor/core";
import CryptoJS from "crypto-js";

// ─── Cryptographic Envelope ──────────────────────────────────────────────────

export const encryptBackup = (payloadString, key) => {
  try {
    const iv = CryptoJS.lib.WordArray.random(16);
    const encrypted = CryptoJS.AES.encrypt(payloadString, key, { iv: iv });
    const ciphertext = encrypted.toString();
    const ivHex = iv.toString();

    // Sign the ciphertext using HMAC-SHA256 to ensure integrity
    const hmac = CryptoJS.HmacSHA256(ciphertext, key).toString();

    const envelope = {
      magic: "JOURNALCRYPT",
      version: 1,
      iv: ivHex,
      hmac: hmac,
      ciphertext: ciphertext,
    };

    return JSON.stringify(envelope);
  } catch (e) {
    throw new Error("Encryption failed: " + e.message, { cause: e });
  }
};

export const decryptBackup = (envelopeString, key) => {
  try {
    const envelope = JSON.parse(envelopeString);
    if (!envelope || envelope.magic !== "JOURNALCRYPT") {
      throw new Error("Invalid backup file format (Magic header missing)");
    }

    // Verify HMAC signature
    const expectedHmac = CryptoJS.HmacSHA256(envelope.ciphertext, key).toString();
    if (envelope.hmac !== expectedHmac) {
      throw new Error("Decryption failed: Incorrect key/password or file tampered");
    }

    const iv = CryptoJS.enc.Hex.parse(envelope.iv);
    const decrypted = CryptoJS.AES.decrypt(envelope.ciphertext, key, { iv: iv });
    const decryptedText = decrypted.toString(CryptoJS.enc.Utf8);

    if (!decryptedText) {
      throw new Error("Failed to parse decrypted data");
    }

    return decryptedText;
  } catch (e) {
    throw new Error(e.message || "Decryption failed", { cause: e });
  }
};

// ─── Google Drive REST Client ────────────────────────────────────────────────

let isGoogleInitialized = false;
let initializedClientId = null;
let initializedRedirectUrl = null;

export const initGoogleSignIn = async (clientId) => {
  const currentRedirectUrl = typeof window !== "undefined" ? window.location.origin : undefined;
  if (isGoogleInitialized && initializedClientId === clientId && initializedRedirectUrl === currentRedirectUrl) {
    return;
  }
  if (!clientId) throw new Error("Google Web Client ID is required for Google Sign-In");

  try {
    const initOptions = {
      clientId: clientId,
      scopes: ["https://www.googleapis.com/auth/drive.appdata"],
    };
    if (currentRedirectUrl) {
      initOptions.redirectUrl = currentRedirectUrl;
    }
    await GoogleSignIn.initialize(initOptions);
    isGoogleInitialized = true;
    initializedClientId = clientId;
    initializedRedirectUrl = currentRedirectUrl;
  } catch (e) {
    console.error("Failed to initialize Google Sign-In:", e);
    throw new Error("Initialization failed: " + e.message, { cause: e });
  }
};

export const loginGoogle = async (clientId) => {
  await initGoogleSignIn(clientId);
  try {
    const response = await GoogleSignIn.signIn();
    if (!response || !response.accessToken) {
      throw new Error("Authentication failed: No access token received");
    }
    
    // Debug token type
    if (!response.accessToken.startsWith("ya29.")) {
      throw new Error("Invalid Token Type Received. Token starts with: " + response.accessToken.substring(0, 15) + "... (Is it an ID token?)");
    }

    return {
      accessToken: response.accessToken,
      email: response.email || "",
      displayName: response.displayName || ""
    };
  } catch (e) {
    console.error("Google Sign-In error:", e);
    throw new Error(e.message || "Google Authentication failed", { cause: e });
  }
};

export const handleGoogleRedirect = async (clientId) => {
  if (Capacitor.getPlatform() !== "web") return null;
  await initGoogleSignIn(clientId);
  try {
    const response = await GoogleSignIn.handleRedirectCallback();
    if (response && response.accessToken) {
      return {
        accessToken: response.accessToken,
        email: response.email || "",
        displayName: response.displayName || ""
      };
    }
    return null;
  } catch (e) {
    console.error("Google Redirect Callback error:", e);
    return null;
  }
};

// API Helper to send fetch requests directly from the client
const callGDriveApi = async (url, options, accessToken) => {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    ...options.headers,
  };

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let errMsg = "API Call failed";
    try {
      const errJson = await res.json();
      errMsg = errJson.error?.message || errMsg;
    } catch (err) {
      console.warn("Failed to parse error response JSON:", err);
    }
    throw new Error(`Google Drive API error: ${errMsg} (Status ${res.status})`);
  }

  if (options.headers?.Accept === "application/json" || url.includes("fields=")) {
    return await res.json();
  }
  return res;
};

// List backup files in the AppData Folder
export const listDriveBackups = async (accessToken) => {
  const url = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name+contains+'backup_'&orderBy=createdTime+desc&fields=files(id,name,createdTime)`;
  const data = await callGDriveApi(url, { method: "GET" }, accessToken);
  return data.files || [];
};

// Download backup content
export const downloadDriveBackup = async (fileId, accessToken) => {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const res = await callGDriveApi(url, { method: "GET" }, accessToken);
  return await res.text();
};

// Create a new backup in Drive AppDataFolder
export const uploadDriveBackup = async (filename, content, accessToken) => {
  // First, list existing files to see if we already have a backup with the same name
  const existingFiles = await listDriveBackups(accessToken);
  const match = existingFiles.find((f) => f.name === filename);

  if (match) {
    // Update existing file
    const url = `https://www.googleapis.com/upload/drive/v3/files/${match.id}?uploadType=media`;
    await callGDriveApi(url, {
      method: "PATCH",
      headers: { "Content-Type": "text/plain" },
      body: content,
    }, accessToken);
    return { id: match.id, status: "updated" };
  } else {
    // Create new file metadata
    const metadataUrl = `https://www.googleapis.com/drive/v3/files`;
    const metadata = {
      name: filename,
      parents: ["appDataFolder"],
    };

    const fileMeta = await callGDriveApi(metadataUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(metadata),
    }, accessToken);

    // Upload content
    const url = `https://www.googleapis.com/upload/drive/v3/files/${fileMeta.id}?uploadType=media`;
    await callGDriveApi(url, {
      method: "PATCH",
      headers: { "Content-Type": "text/plain" },
      body: content,
    }, accessToken);

    return { id: fileMeta.id, status: "created" };
  }
};

// Delete a backup
export const deleteDriveBackup = async (fileId, accessToken) => {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}`;
  await callGDriveApi(url, { method: "DELETE" }, accessToken);
};

// Keep last 5 rolling backups and delete older ones
export const rotateDriveBackups = async (accessToken) => {
  try {
    const files = await listDriveBackups(accessToken);
    if (files.length > 5) {
      // Sort files by creation date (newest first)
      const toDelete = files.slice(5);
      for (const file of toDelete) {
        await deleteDriveBackup(file.id, accessToken);
        console.log("Deleted old backup file:", file.name);
      }
    }
  } catch (e) {
    console.error("Backup rotation failed:", e);
  }
};

// ─── Local Filesystem Export ─────────────────────────────────────────────────

export const exportLocalFile = async (filename, content) => {
  try {
    // Save to the documents directory
    const result = await Filesystem.writeFile({
      path: filename,
      data: content,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
    });
    return { success: true, uri: result.uri };
  } catch (e) {
    console.error("Local file export failed:", e);
    throw new Error("Local export failed: " + e.message, { cause: e });
  }
};
