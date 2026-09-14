import { Injectable, signal } from '@angular/core';

export interface ApiKeyConfig {
  provider: 'gemini' | 'openai' | 'groq' | 'anthropic' | 'openrouter' | 'custom';
  name: string;
  key: string;
  endpointUrl?: string;
  isActive: boolean;
  addedAt: number;
}

export interface SecurityStatus {
  atRestEncryption: boolean;
  activeKeyFingerprint: string;
  zeroKnowledgeMode: boolean;
  tlsInTransit: boolean;
  vaultUnlocked: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class CryptoService {
  private readonly MASTER_KEY_STORAGE = 'eloqui_master_key_raw';
  private readonly BYOK_API_KEYS_STORAGE = 'eloqui_byok_api_keys';
  private readonly ENCRYPTION_ENABLED_KEY = 'eloqui_encryption_enabled';

  // Signals for reactive UI
  readonly isAtRestEncryptionEnabled = signal<boolean>(this.loadEncryptionPreference());
  readonly activeKeyFingerprint = signal<string>('');
  readonly isVaultUnlocked = signal<boolean>(true);
  readonly apiKeys = signal<ApiKeyConfig[]>(this.loadApiKeys());

  private cryptoKey: CryptoKey | null = null;
  private rawKeyString: string = '';

  constructor() {
    this.initMasterKey();
  }

  private loadEncryptionPreference(): boolean {
    try {
      const stored = localStorage.getItem(this.ENCRYPTION_ENABLED_KEY);
      return stored ? JSON.parse(stored) : true;
    } catch {
      return true;
    }
  }

  private loadApiKeys(): ApiKeyConfig[] {
    try {
      const stored = localStorage.getItem(this.BYOK_API_KEYS_STORAGE);
      if (stored) return JSON.parse(stored);
    } catch {}
    // Seed default Gemini key configuration if environment provides one
    return [
      {
        provider: 'gemini',
        name: 'Default Gemini Free Tier',
        key: '',
        isActive: true,
        addedAt: Date.now()
      }
    ];
  }

  private async initMasterKey() {
    try {
      let saved = localStorage.getItem(this.MASTER_KEY_STORAGE);
      if (!saved) {
        // Generate initial random 256-bit AES key
        const array = new Uint8Array(32);
        window.crypto.getRandomValues(array);
        saved = Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
        localStorage.setItem(this.MASTER_KEY_STORAGE, saved);
      }
      await this.setRawKey(saved);
    } catch (e) {
      console.warn('Crypto init error', e);
      this.activeKeyFingerprint.set('LOCAL_DEV_SALT');
    }
  }

  async setRawKey(hexString: string): Promise<void> {
    try {
      this.rawKeyString = hexString.trim();
      localStorage.setItem(this.MASTER_KEY_STORAGE, this.rawKeyString);

      // Compute SHA-256 fingerprint for display
      const encoder = new TextEncoder();
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', encoder.encode(this.rawKeyString));
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const fingerprint = hashArray.slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
      this.activeKeyFingerprint.set(`SHA256:${fingerprint}`);

      // Derive AES-GCM CryptoKey
      const keyData = new Uint8Array(
        (this.rawKeyString.match(/.{1,2}/g) || []).map(byte => parseInt(byte, 16))
      );
      this.cryptoKey = await window.crypto.subtle.importKey(
        'raw',
        keyData.length === 32 ? keyData : encoder.encode(this.rawKeyString.padEnd(32, '0').slice(0, 32)),
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt']
      );
      this.isVaultUnlocked.set(true);
    } catch (e) {
      console.error('Failed to import AES key', e);
    }
  }

  async generateNewMasterKey(): Promise<string> {
    const array = new Uint8Array(32);
    window.crypto.getRandomValues(array);
    const hex = Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
    await this.setRawKey(hex);
    return hex;
  }

  getRawKey(): string {
    return this.rawKeyString;
  }

  toggleAtRestEncryption(enabled: boolean) {
    this.isAtRestEncryptionEnabled.set(enabled);
    localStorage.setItem(this.ENCRYPTION_ENABLED_KEY, JSON.stringify(enabled));
  }

  // Encrypt plaintext string using AES-GCM 256
  async encryptText(plaintext: string): Promise<string> {
    if (!this.isAtRestEncryptionEnabled() || !this.cryptoKey) {
      return plaintext;
    }
    try {
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const encoder = new TextEncoder();
      const ciphertext = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        this.cryptoKey,
        encoder.encode(plaintext)
      );
      const combined = new Uint8Array(iv.length + ciphertext.byteLength);
      combined.set(iv, 0);
      combined.set(new Uint8Array(ciphertext), iv.length);
      
      // Return base64 with marker
      const base64 = btoa(String.fromCharCode(...combined));
      return `__ELOQUI_ENC_V1__:${base64}`;
    } catch (e) {
      console.error('Encryption failed, storing as plaintext', e);
      return plaintext;
    }
  }

  // Decrypt ciphertext using AES-GCM 256
  async decryptText(payload: string): Promise<string> {
    if (!payload || !payload.startsWith('__ELOQUI_ENC_V1__:')) {
      return payload; // Plaintext or unencrypted
    }
    if (!this.cryptoKey) {
      return payload;
    }
    try {
      const base64 = payload.replace('__ELOQUI_ENC_V1__:', '');
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const iv = bytes.slice(0, 12);
      const ciphertext = bytes.slice(12);

      const decrypted = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        this.cryptoKey,
        ciphertext
      );
      return new TextDecoder().decode(decrypted);
    } catch (e) {
      console.warn('Decryption failed, might be using different key', e);
      return payload;
    }
  }

  // Manage BYOK API keys
  saveApiKey(config: ApiKeyConfig) {
    const existing = this.apiKeys().filter(k => k.provider !== config.provider || k.name !== config.name);
    const updated = [...existing, config];
    this.apiKeys.set(updated);
    localStorage.setItem(this.BYOK_API_KEYS_STORAGE, JSON.stringify(updated));
  }

  removeApiKey(name: string) {
    const updated = this.apiKeys().filter(k => k.name !== name);
    this.apiKeys.set(updated);
    localStorage.setItem(this.BYOK_API_KEYS_STORAGE, JSON.stringify(updated));
  }

  getActiveKeyForProvider(provider: string): string | undefined {
    const found = this.apiKeys().find(k => k.provider === provider && k.isActive);
    return found?.key;
  }
}
