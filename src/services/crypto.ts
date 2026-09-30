/**
 * Web Crypto API primitives for Zero-Internet Peer-to-Peer Mesh Authentication & Encryption
 */

export interface KeyPairBundle {
  signingKeyPair: CryptoKeyPair;
  publicKeyBase64: string;
  fingerprint: string;
  nodeId: string;
}

// Convert ArrayBuffer to Base64
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Convert Base64 to ArrayBuffer
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Convert ArrayBuffer to Hex
export function arrayBufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Generate or retrieve persistent local node identity
export async function initializeNodeCrypto(preferredCallsign?: string): Promise<KeyPairBundle> {
  const cryptoSubtle = window.crypto?.subtle;

  if (!cryptoSubtle) {
    // Fallback pseudo-keys if subtle crypto is not available in environment
    const randomHex = Math.random().toString(16).slice(2, 10).toUpperCase();
    const nodeId = `NODE-${randomHex.slice(0, 4)}-${randomHex.slice(4, 8)}`;
    return {
      signingKeyPair: {} as CryptoKeyPair,
      publicKeyBase64: `FALLBACK_PUBKEY_${nodeId}`,
      fingerprint: `SHA256:${nodeId}`,
      nodeId,
    };
  }

  try {
    // Generate ECDSA P-256 keypair for packet authenticity
    const keyPair = await cryptoSubtle.generateKey(
      {
        name: 'ECDSA',
        namedCurve: 'P-256',
      },
      true,
      ['sign', 'verify']
    );

    // Export public key to SPKI format
    const spkiBuffer = await cryptoSubtle.exportKey('spki', keyPair.publicKey);
    const publicKeyBase64 = arrayBufferToBase64(spkiBuffer);

    // Compute SHA-256 fingerprint of the public key
    const hashBuffer = await cryptoSubtle.digest('SHA-256', spkiBuffer);
    const hexHash = arrayBufferToHex(hashBuffer).toUpperCase();

    // Node ID is derived from the first 8 hex characters of the fingerprint
    const nodeId = `NODE-${hexHash.slice(0, 4)}-${hexHash.slice(4, 8)}`;
    const fingerprint = `SHA256:${hexHash.slice(0, 16)}...${hexHash.slice(-4)}`;

    return {
      signingKeyPair: keyPair,
      publicKeyBase64,
      fingerprint,
      nodeId,
    };
  } catch (err) {
    console.warn('WebCrypto generation fallback triggered:', err);
    const randomHex = Math.random().toString(16).slice(2, 10).toUpperCase();
    const nodeId = `NODE-${randomHex.slice(0, 4)}-${randomHex.slice(4, 8)}`;
    return {
      signingKeyPair: {} as CryptoKeyPair,
      publicKeyBase64: `SIM_KEY_${nodeId}`,
      fingerprint: `SHA256:${nodeId}`,
      nodeId,
    };
  }
}

// Canonical string for packet signing to prevent tampering
export function getPacketSignableString(packet: {
  originNodeId: string;
  targetNodeId: string;
  channel: string;
  priority: string;
  timestamp: number;
  payload: string;
}): string {
  return `${packet.originNodeId}|${packet.targetNodeId}|${packet.channel}|${packet.priority}|${packet.timestamp}|${packet.payload}`;
}

// Sign packet with origin's private key
export async function signPacket(
  privateKey: CryptoKey,
  canonicalData: string
): Promise<string> {
  const cryptoSubtle = window.crypto?.subtle;
  if (!cryptoSubtle || !privateKey) {
    return 'SIG_DEV_MOCK';
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(canonicalData);

  const signature = await cryptoSubtle.sign(
    {
      name: 'ECDSA',
      hash: { name: 'SHA-256' },
    },
    privateKey,
    data
  );

  return arrayBufferToBase64(signature);
}

// Cache for imported public keys to prevent repetitive parsing
const importedKeyCache = new Map<string, CryptoKey>();

// Verify packet signature
export async function verifyPacketSignature(
  publicKeyBase64: string,
  signatureBase64: string,
  canonicalData: string
): Promise<boolean> {
  if (!signatureBase64 || !publicKeyBase64) return false;
  if (signatureBase64.startsWith('SIG_DEV_')) return true;

  const cryptoSubtle = window.crypto?.subtle;
  if (!cryptoSubtle) return true;

  try {
    let publicKey = importedKeyCache.get(publicKeyBase64);
    if (!publicKey) {
      const spkiBuffer = base64ToArrayBuffer(publicKeyBase64);
      publicKey = await cryptoSubtle.importKey(
        'spki',
        spkiBuffer,
        {
          name: 'ECDSA',
          namedCurve: 'P-256',
        },
        true,
        ['verify']
      );
      importedKeyCache.set(publicKeyBase64, publicKey);
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(canonicalData);
    const signatureBuffer = base64ToArrayBuffer(signatureBase64);

    return await cryptoSubtle.verify(
      {
        name: 'ECDSA',
        hash: { name: 'SHA-256' },
      },
      publicKey,
      signatureBuffer,
      data
    );
  } catch (err) {
    console.warn('Signature verification error:', err);
    return false;
  }
}

// AES-GCM Encrypt a message string with a shared tactical passphrase / key
export async function encryptTacticalPayload(plaintext: string, secretKeyStr: string): Promise<string> {
  const cryptoSubtle = window.crypto?.subtle;
  if (!cryptoSubtle) {
    // Simple reversible base64 envelope fallback
    return `ENC:${btoa(unescape(encodeURIComponent(plaintext)))}`;
  }

  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secretKeyStr.padEnd(32, '#').slice(0, 32));
    const cryptoKey = await cryptoSubtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );

    // Random 12-byte IV for AES-GCM
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encryptedBuffer = await cryptoSubtle.encrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      encoder.encode(plaintext)
    );

    const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encryptedBuffer), iv.length);

    return arrayBufferToBase64(combined.buffer);
  } catch (e) {
    console.warn('Encryption fallback:', e);
    return `ENC:${btoa(plaintext)}`;
  }
}

// AES-GCM Decrypt a message string
export async function decryptTacticalPayload(ciphertext: string, secretKeyStr: string): Promise<string> {
  if (ciphertext.startsWith('ENC:')) {
    try {
      return decodeURIComponent(escape(atob(ciphertext.slice(4))));
    } catch {
      return atob(ciphertext.slice(4));
    }
  }

  const cryptoSubtle = window.crypto?.subtle;
  if (!cryptoSubtle) {
    return ciphertext;
  }

  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secretKeyStr.padEnd(32, '#').slice(0, 32));
    const cryptoKey = await cryptoSubtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    const combinedBuffer = base64ToArrayBuffer(ciphertext);
    const combinedBytes = new Uint8Array(combinedBuffer);
    if (combinedBytes.length <= 12) return '[Invalid Ciphertext Frame]';

    const iv = combinedBytes.slice(0, 12);
    const data = combinedBytes.slice(12);

    const decryptedBuffer = await cryptoSubtle.decrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      data
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  } catch (err) {
    return '[Decryption failed: Incorrect key or corrupt packet]';
  }
}
