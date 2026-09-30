import { Injectable, inject, signal, effect } from '@angular/core';
import { StorageService, Document, Chapter } from './storage.service';
import { BlockService } from './block.service';
import { CryptoService } from './crypto.service';
import { PrivacyService } from './privacy.service';
import JSZip from 'jszip';

export type BackupMethod = 
  | 'encrypted_vault' 
  | 'json_vault' 
  | 'zip_bundle' 
  | 'incremental' 
  | 'active_doc' 
  | 'disaster_html';

export type RemoteType = 
  | 'download' 
  | 'local_dir' 
  | 'github' 
  | 's3' 
  | 'webdav' 
  | 'webhook';

export interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
  branch: string;
  path: string;
  isGist: boolean;
  gistId?: string;
  description?: string;
}

export interface S3Config {
  endpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  prefix: string;
}

export interface WebDAVConfig {
  serverUrl: string;
  path: string;
  username?: string;
  password?: string;
  token?: string;
}

export interface WebhookConfig {
  endpointUrl: string;
  method: 'POST' | 'PUT';
  secret?: string;
  customHeaders?: Record<string, string>;
}

export interface LocalDirConfig {
  directoryName: string;
}

export interface RemoteConfig {
  id: string;
  name: string;
  type: RemoteType;
  isDefault: boolean;
  createdAt: number;
  lastSynced?: number;
  lastStatus?: 'success' | 'failed';
  lastError?: string;
  // Specific settings
  github?: GitHubConfig;
  s3?: S3Config;
  webdav?: WebDAVConfig;
  webhook?: WebhookConfig;
  localDir?: LocalDirConfig;
}

export interface BackupLogItem {
  id: string;
  timestamp: number;
  method: BackupMethod;
  remoteId: string;
  remoteName: string;
  remoteType: RemoteType;
  status: 'success' | 'failed' | 'in_progress';
  filename: string;
  sizeBytes: number;
  docCount: number;
  chapterCount: number;
  remoteUrl?: string;
  error?: string;
  checksumSha256?: string;
}

export interface AutoBackupSettings {
  enabled: boolean;
  intervalMinutes: number; // 10, 30, 60, or -1 (on every document save)
  preferredMethod: BackupMethod;
  targetRemoteId: string;
  retentionMaxLogs: number;
  includeChatHistory: boolean;
  includeAnalytics: boolean;
}

export interface BackupInspectionResult {
  valid: boolean;
  format: 'encrypted' | 'json' | 'zip' | 'unknown';
  timestamp?: number;
  dateStr?: string;
  docCount: number;
  chapterCount: number;
  totalWords: number;
  docTitles: string[];
  requiresPassword?: boolean;
  rawPayload?: any;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class BackupService {
  private storage = inject(StorageService);
  private blockService = inject(BlockService);
  private crypto = inject(CryptoService);
  private privacy = inject(PrivacyService);

  private readonly REMOTES_STORAGE_KEY = 'eloqui_backup_remotes';
  private readonly LOGS_STORAGE_KEY = 'eloqui_backup_logs';
  private readonly SETTINGS_STORAGE_KEY = 'eloqui_backup_auto_settings';
  private readonly LAST_BACKUP_TIME_KEY = 'eloqui_last_backup_timestamp';

  // Signals
  readonly remotes = signal<RemoteConfig[]>(this.loadRemotes());
  readonly backupLogs = signal<BackupLogItem[]>(this.loadLogs());
  readonly autoSettings = signal<AutoBackupSettings>(this.loadAutoSettings());
  readonly lastBackupTimestamp = signal<number>(this.loadLastBackupTime());
  
  // Status signals
  readonly isBackingUp = signal<boolean>(false);
  readonly backupProgressMessage = signal<string>('');
  readonly activeLocalDirectoryHandle = signal<FileSystemDirectoryHandle | null>(null);

  private autoBackupTimer: any = null;

  constructor() {
    this.initDefaultRemotesIfEmpty();
    this.initAutoBackupScheduler();
  }

  // --- Remote Configuration Management ---

  private loadRemotes(): RemoteConfig[] {
    try {
      const stored = localStorage.getItem(this.REMOTES_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const seen = new Set<string>();
          return parsed.filter(r => {
            if (seen.has(r.id)) return false;
            seen.add(r.id);
            return true;
          });
        }
      }
    } catch {}
    return [];
  }

  private initDefaultRemotesIfEmpty() {
    if (this.remotes().length === 0) {
      const defaultRemotes: RemoteConfig[] = [
        {
          id: 'remote-browser-download',
          name: 'Direct Browser Download',
          type: 'download',
          isDefault: true,
          createdAt: Date.now()
        },
        {
          id: 'remote-github-sample',
          name: 'GitHub Repository Backup',
          type: 'github',
          isDefault: false,
          createdAt: Date.now(),
          github: {
            token: '',
            owner: '',
            repo: 'eloqui-backups',
            branch: 'main',
            path: 'backups',
            isGist: false
          }
        },
        {
          id: 'remote-s3-sample',
          name: 'AWS S3 / Cloudflare R2 / MinIO',
          type: 's3',
          isDefault: false,
          createdAt: Date.now(),
          s3: {
            endpoint: '',
            region: 'us-east-1',
            bucket: 'my-writing-vault',
            accessKeyId: '',
            secretAccessKey: '',
            prefix: 'eloqui/archives'
          }
        },
        {
          id: 'remote-webdav-sample',
          name: 'Nextcloud / ownCloud WebDAV',
          type: 'webdav',
          isDefault: false,
          createdAt: Date.now(),
          webdav: {
            serverUrl: '',
            path: 'Backups/Eloqui',
            username: '',
            password: ''
          }
        },
        {
          id: 'remote-webhook-sample',
          name: 'Custom Webhook / Automation Endpoint',
          type: 'webhook',
          isDefault: false,
          createdAt: Date.now(),
          webhook: {
            endpointUrl: '',
            method: 'POST'
          }
        }
      ];
      this.saveRemotes(defaultRemotes);
    }
  }

  saveRemotes(remotes: RemoteConfig[]) {
    this.remotes.set(remotes);
    try {
      localStorage.setItem(this.REMOTES_STORAGE_KEY, JSON.stringify(remotes));
    } catch (e) {
      console.error('Failed to save remotes to localStorage', e);
    }
  }

  addOrUpdateRemote(remote: RemoteConfig) {
    const list = [...this.remotes()];
    const index = list.findIndex(r => r.id === remote.id);
    if (index >= 0) {
      list[index] = remote;
    } else {
      list.push(remote);
    }

    // Ensure only one default
    if (remote.isDefault) {
      for (const r of list) {
        if (r.id !== remote.id) r.isDefault = false;
      }
    }
    this.saveRemotes(list);
  }

  deleteRemote(id: string) {
    const filtered = this.remotes().filter(r => r.id !== id);
    if (filtered.length > 0 && !filtered.some(r => r.isDefault)) {
      filtered[0].isDefault = true;
    }
    this.saveRemotes(filtered);
  }

  setDefaultRemote(id: string) {
    const updated = this.remotes().map(r => ({
      ...r,
      isDefault: r.id === id
    }));
    this.saveRemotes(updated);
  }

  // --- Logs & Audit ---

  private loadLogs(): BackupLogItem[] {
    try {
      const stored = localStorage.getItem(this.LOGS_STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch {}
    return [];
  }

  private saveLogs(logs: BackupLogItem[]) {
    this.backupLogs.set(logs);
    try {
      localStorage.setItem(this.LOGS_STORAGE_KEY, JSON.stringify(logs));
    } catch {}
  }

  addLog(item: BackupLogItem) {
    const max = this.autoSettings().retentionMaxLogs || 50;
    const current = [item, ...this.backupLogs()].slice(0, max);
    this.saveLogs(current);
  }

  clearLogs() {
    this.saveLogs([]);
  }

  // --- Auto Backup Settings ---

  private loadAutoSettings(): AutoBackupSettings {
    try {
      const stored = localStorage.getItem(this.SETTINGS_STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch {}
    return {
      enabled: false,
      intervalMinutes: 30,
      preferredMethod: 'encrypted_vault',
      targetRemoteId: 'remote-browser-download',
      retentionMaxLogs: 50,
      includeChatHistory: true,
      includeAnalytics: true
    };
  }

  saveAutoSettings(settings: AutoBackupSettings) {
    this.autoSettings.set(settings);
    try {
      localStorage.setItem(this.SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {}
    this.initAutoBackupScheduler();
  }

  private loadLastBackupTime(): number {
    try {
      const val = localStorage.getItem(this.LAST_BACKUP_TIME_KEY);
      return val ? parseInt(val, 10) : 0;
    } catch {
      return 0;
    }
  }

  private updateLastBackupTime(ts: number) {
    this.lastBackupTimestamp.set(ts);
    try {
      localStorage.setItem(this.LAST_BACKUP_TIME_KEY, ts.toString());
    } catch {}
  }

  // --- Auto-Backup Scheduler ---

  private initAutoBackupScheduler() {
    if (this.autoBackupTimer) {
      clearInterval(this.autoBackupTimer);
      this.autoBackupTimer = null;
    }

    const cfg = this.autoSettings();
    if (!cfg.enabled || cfg.intervalMinutes <= 0) return;

    const ms = cfg.intervalMinutes * 60 * 1000;
    this.autoBackupTimer = setInterval(() => {
      this.triggerAutoBackup();
    }, ms);
  }

  async triggerAutoBackup() {
    const cfg = this.autoSettings();
    if (!cfg.enabled || this.isBackingUp()) return;

    const targetRemote = this.remotes().find(r => r.id === cfg.targetRemoteId) || this.remotes().find(r => r.isDefault);
    if (!targetRemote) return;

    try {
      await this.executeBackup(cfg.preferredMethod, targetRemote.id);
    } catch (e) {
      console.warn('Auto backup cycle failed:', e);
    }
  }

  // --- Local Directory Picker (FileSystem API) ---

  async selectLocalDirectory(): Promise<string | null> {
    if (!('showDirectoryPicker' in window)) {
      throw new Error('Your browser does not support the File System Access API. Please use direct download or cloud remotes.');
    }
    try {
      const dirHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
      this.activeLocalDirectoryHandle.set(dirHandle);

      // Create or update remote entry
      const existing = this.remotes().find(r => r.type === 'local_dir');
      if (existing) {
        existing.name = `Local Directory: ${dirHandle.name}`;
        if (!existing.localDir) existing.localDir = { directoryName: dirHandle.name };
        else existing.localDir.directoryName = dirHandle.name;
        this.addOrUpdateRemote(existing);
        return existing.id;
      } else {
        const newRemote: RemoteConfig = {
          id: `remote-local-dir-${Date.now()}`,
          name: `Local Folder: ${dirHandle.name}`,
          type: 'local_dir',
          isDefault: false,
          createdAt: Date.now(),
          localDir: { directoryName: dirHandle.name }
        };
        this.addOrUpdateRemote(newRemote);
        return newRemote.id;
      }
    } catch (e: any) {
      if (e.name === 'AbortError') return null;
      throw e;
    }
  }

  // --- Connection Verification ---

  async testConnection(remote: RemoteConfig): Promise<{ ok: boolean; message: string; details?: any }> {
    if (remote.type === 'download') {
      return { ok: true, message: 'Browser Direct Download is always available locally.' };
    }

    if (remote.type === 'local_dir') {
      if (this.activeLocalDirectoryHandle()) {
        return { ok: true, message: `Connected to directory "${this.activeLocalDirectoryHandle()!.name}". Permissions granted.` };
      }
      return { ok: false, message: 'No folder handle active in this session. Click "Select Folder" to grant access.' };
    }

    let configPayload: any = {};
    if (remote.type === 'github') configPayload = remote.github || {};
    if (remote.type === 's3') configPayload = remote.s3 || {};
    if (remote.type === 'webdav') configPayload = remote.webdav || {};
    if (remote.type === 'webhook') configPayload = remote.webhook || {};

    try {
      const res = await fetch('/api/backup/remote/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          remoteType: remote.type,
          config: configPayload
        })
      });

      const data = await res.json();
      if (data.ok) {
        // Update remote status
        const updated = this.remotes().map(r => r.id === remote.id ? { ...r, lastStatus: 'success' as const, lastError: undefined } : r);
        this.saveRemotes(updated);
        return { ok: true, message: data.message || 'Connection test successful!', details: data.details };
      } else {
        const updated = this.remotes().map(r => r.id === remote.id ? { ...r, lastStatus: 'failed' as const, lastError: data.error } : r);
        this.saveRemotes(updated);
        return { ok: false, message: data.error || 'Connection failed' };
      }
    } catch (e: any) {
      return { ok: false, message: e.message || 'Network error reaching backend test runner' };
    }
  }

  // --- Main Backup Orchestrator ---

  async executeBackup(
    method: BackupMethod,
    remoteId: string,
    customPassword?: string
  ): Promise<BackupLogItem> {
    const remote = this.remotes().find(r => r.id === remoteId);
    if (!remote) {
      throw new Error(`Remote destination "${remoteId}" not found`);
    }

    this.isBackingUp.set(true);
    this.backupProgressMessage.set(`Preparing ${this.getMethodLabel(method)}...`);

    const logId = `backup-${Date.now()}`;
    const timestamp = Date.now();
    const dateStamp = new Date().toISOString().replace(/[:.]/g, '-');

    try {
      // 1. Gather all documents
      const allDocs = await this.storage.getAllDocuments();
      let docsToInclude: Document[] = allDocs;

      if (method === 'active_doc') {
        const cur = this.blockService.currentDoc();
        docsToInclude = cur ? [cur] : (allDocs.length > 0 ? [allDocs[0]] : []);
      } else if (method === 'incremental') {
        const lastTime = this.lastBackupTimestamp();
        docsToInclude = allDocs.filter(d => (d.lastModified || 0) > lastTime);
        if (docsToInclude.length === 0) {
          // If none changed, include at least the active or latest doc
          docsToInclude = allDocs.slice(0, 1);
        }
      }

      // Count stats
      let totalChapters = 0;
      let totalWords = 0;
      for (const d of docsToInclude) {
        totalChapters += (d.chapters?.length || 0);
        for (const c of (d.chapters || [])) {
          totalWords += (c.content || '').replace(/<[^>]*>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
        }
      }

      // 2. Build Artifact according to method
      let filename = '';
      let payloadContent: string | ArrayBuffer = '';
      let isBinary = false;
      let contentType = 'application/json';

      this.backupProgressMessage.set(`Building payload (${docsToInclude.length} docs, ${totalChapters} chapters)...`);

      if (method === 'encrypted_vault') {
        filename = `eloqui-vault-encrypted-${dateStamp}.eloqui-backup.enc`;
        contentType = 'application/octet-stream';
        
        const vaultContainer = {
          format: 'eloqui-vault-archive',
          schemaVersion: 1,
          createdAt: timestamp,
          source: 'Eloqui Private Sovereign Assistant',
          documents: docsToInclude,
          metadata: {
            totalDocs: docsToInclude.length,
            totalChapters,
            totalWords
          }
        };

        const jsonString = JSON.stringify(vaultContainer);
        const pass = (customPassword && customPassword.trim()) || this.crypto.getRawKey() || 'eloqui-secure-vault-pass';
        
        const encryptedEnvelope = await this.encryptContainerWithPassword(jsonString, pass);
        payloadContent = JSON.stringify(encryptedEnvelope, null, 2);
      } 
      else if (method === 'json_vault' || method === 'incremental' || method === 'active_doc') {
        const prefix = method === 'incremental' ? 'incremental' : (method === 'active_doc' ? 'doc' : 'vault');
        filename = `eloqui-${prefix}-${dateStamp}.eloqui-vault.json`;
        contentType = 'application/json';

        const vaultContainer = {
          format: 'eloqui-vault-archive',
          method,
          schemaVersion: 1,
          createdAt: timestamp,
          documents: docsToInclude,
          metadata: {
            totalDocs: docsToInclude.length,
            totalChapters,
            totalWords
          }
        };
        payloadContent = JSON.stringify(vaultContainer, null, 2);
      } 
      else if (method === 'zip_bundle') {
        filename = `eloqui-manuscript-archive-${dateStamp}.zip`;
        contentType = 'application/zip';
        isBinary = true;

        const zip = new JSZip();

        // 1. Manifest
        const manifest = {
          exportedAt: new Date().toISOString(),
          timestamp,
          totalDocuments: docsToInclude.length,
          totalChapters,
          totalWords,
          documents: docsToInclude.map(d => ({
            id: d.id,
            title: d.title,
            chapters: (d.chapters || []).map(c => ({ id: c.id, title: c.title, wordCount: (c.content || '').replace(/<[^>]*>/g, ' ').trim().split(/\s+/).filter(Boolean).length }))
          }))
        };
        zip.file('Manifest.json', JSON.stringify(manifest, null, 2));

        // 2. Manuscripts folders
        for (const doc of docsToInclude) {
          const docFolderSafe = (doc.title || 'Untitled').replace(/[/\\?%*:|"<>]/g, '_').trim();
          const docFolder = zip.folder(`Manuscripts/${docFolderSafe}`);

          (doc.chapters || []).forEach((ch, idx) => {
            const chTitleSafe = (ch.title || `Chapter_${idx + 1}`).replace(/[/\\?%*:|"<>]/g, '_').trim();
            const md = this.htmlToCleanMarkdown(ch.content || '', ch.title);
            docFolder?.file(`${String(idx + 1).padStart(2, '0')}_${chTitleSafe}.md`, md);
          });

          // Metadata per doc
          docFolder?.file('document-settings.json', JSON.stringify({
            id: doc.id,
            title: doc.title,
            isUncensored: doc.isUncensored,
            censorshipConfig: doc.censorshipConfig,
            goals: doc.goals
          }, null, 2));

          // Chat Sessions
          if (doc.chatSessions && doc.chatSessions.length > 0) {
            const chatFolder = zip.folder(`ChatHistory/${docFolderSafe}`);
            doc.chatSessions.forEach(session => {
              const sessionSafe = (session.title || 'chat').replace(/[/\\?%*:|"<>]/g, '_').trim();
              chatFolder?.file(`${sessionSafe}.json`, JSON.stringify(session, null, 2));
            });
          }
        }

        // 3. Analytics
        const analyticsRows = ['Timestamp,Date,DocumentTitle,ChapterTitle,WordCount'];
        for (const doc of docsToInclude) {
          for (const point of (doc.wordCountHistory || [])) {
            analyticsRows.push(`${point.timestamp},${new Date(point.timestamp).toISOString()},"${doc.title}","${point.chapterTitle || ''}",${point.wordCount}`);
          }
        }
        zip.file('Analytics/wordcount-history.csv', analyticsRows.join('\n'));

        // Generate base64 or arraybuffer
        payloadContent = await zip.generateAsync({ type: 'base64' });
      } 
      else if (method === 'disaster_html') {
        filename = `eloqui-disaster-recovery-reader-${dateStamp}.html`;
        contentType = 'text/html';
        payloadContent = this.generateDisasterHtmlReader(docsToInclude, timestamp);
      }

      // Compute payload size and SHA-256 checksum
      let sizeBytes = 0;
      let checksumSha256 = '';
      if (typeof payloadContent === 'string') {
        sizeBytes = new Blob([payloadContent]).size;
        checksumSha256 = await this.computeSha256(payloadContent);
      }

      this.backupProgressMessage.set(`Dispatching to remote "${remote.name}"...`);

      // 3. Dispatch to remote
      let remoteUrl: string | undefined = undefined;

      if (remote.type === 'download') {
        this.downloadFileLocally(filename, payloadContent, contentType, isBinary);
      } 
      else if (remote.type === 'local_dir') {
        await this.writeToLocalDirectory(filename, payloadContent, isBinary);
      } 
      else if (remote.type === 'github') {
        const ghCfg = remote.github || { token: '', owner: '', repo: '', branch: 'main', path: 'backups', isGist: false };
        const res = await fetch('/api/backup/remote/github', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: ghCfg.token,
            owner: ghCfg.owner,
            repo: ghCfg.repo,
            branch: ghCfg.branch || 'main',
            path: ghCfg.path || 'backups',
            filename,
            content: payloadContent,
            isBase64: isBinary,
            isGist: ghCfg.isGist,
            gistId: ghCfg.gistId
          })
        });
        const ghData = await res.json();
        if (!ghData.ok) throw new Error(ghData.error || 'GitHub backup dispatch failed');
        remoteUrl = ghData.htmlUrl;
      } 
      else if (remote.type === 's3') {
        const s3Cfg = remote.s3 || { region: 'us-east-1', bucket: '', accessKeyId: '', secretAccessKey: '', prefix: 'backups' };
        const res = await fetch('/api/backup/remote/s3', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: s3Cfg.endpoint,
            region: s3Cfg.region,
            bucket: s3Cfg.bucket,
            accessKeyId: s3Cfg.accessKeyId,
            secretAccessKey: s3Cfg.secretAccessKey,
            prefix: s3Cfg.prefix,
            filename,
            content: payloadContent,
            isBase64: isBinary,
            contentType
          })
        });
        const s3Data = await res.json();
        if (!s3Data.ok) throw new Error(s3Data.error || 'S3 backup upload failed');
        remoteUrl = s3Data.location;
      } 
      else if (remote.type === 'webdav') {
        const davCfg = remote.webdav || { serverUrl: '', path: 'Backups' };
        const res = await fetch('/api/backup/remote/webdav', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            serverUrl: davCfg.serverUrl,
            username: davCfg.username,
            password: davCfg.password,
            token: davCfg.token,
            path: davCfg.path,
            filename,
            content: payloadContent,
            isBase64: isBinary,
            contentType
          })
        });
        const davData = await res.json();
        if (!davData.ok) throw new Error(davData.error || 'WebDAV upload failed');
        remoteUrl = davData.url;
      } 
      else if (remote.type === 'webhook') {
        const whCfg = remote.webhook || { endpointUrl: '', method: 'POST' };
        const res = await fetch('/api/backup/remote/webhook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpointUrl: whCfg.endpointUrl,
            method: whCfg.method || 'POST',
            secret: whCfg.secret,
            headers: whCfg.customHeaders || {},
            filename,
            payload: payloadContent
          })
        });
        const whData = await res.json();
        if (!whData.ok) throw new Error(whData.error || 'Webhook dispatch failed');
      }

      // Record success
      this.updateLastBackupTime(timestamp);
      const logItem: BackupLogItem = {
        id: logId,
        timestamp,
        method,
        remoteId: remote.id,
        remoteName: remote.name,
        remoteType: remote.type,
        status: 'success',
        filename,
        sizeBytes,
        docCount: docsToInclude.length,
        chapterCount: totalChapters,
        remoteUrl,
        checksumSha256
      };

      this.addLog(logItem);

      // Update remote metadata
      const updatedRemotes = this.remotes().map(r => r.id === remote.id ? { ...r, lastSynced: timestamp, lastStatus: 'success' as const, lastError: undefined } : r);
      this.saveRemotes(updatedRemotes);

      this.privacy.logEvent({
        category: 'document',
        action: 'Remote Backup Executed',
        details: `Backup ${filename} dispatched to ${remote.name} (${remote.type}). Method: ${method}, Size: ${(sizeBytes / 1024).toFixed(1)} KB`,
        userEmail: 'current_user',
        status: 'processed'
      });

      this.backupProgressMessage.set('Backup completed successfully!');
      setTimeout(() => this.isBackingUp.set(false), 800);

      return logItem;

    } catch (err: any) {
      console.error('Backup execution failed:', err);
      const failedItem: BackupLogItem = {
        id: logId,
        timestamp,
        method,
        remoteId: remote.id,
        remoteName: remote.name,
        remoteType: remote.type,
        status: 'failed',
        filename: 'backup-failed',
        sizeBytes: 0,
        docCount: 0,
        chapterCount: 0,
        error: err.message || 'Backup failed'
      };
      this.addLog(failedItem);

      const updatedRemotes = this.remotes().map(r => r.id === remote.id ? { ...r, lastStatus: 'failed' as const, lastError: err.message } : r);
      this.saveRemotes(updatedRemotes);

      this.isBackingUp.set(false);
      throw err;
    }
  }

  // --- Browser & Directory Helpers ---

  private downloadFileLocally(filename: string, content: string | ArrayBuffer, contentType: string, isBase64: boolean) {
    let blob: Blob;
    if (isBase64 && typeof content === 'string') {
      const binary = atob(content);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      blob = new Blob([bytes], { type: contentType });
    } else {
      blob = new Blob([content], { type: contentType });
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private async writeToLocalDirectory(filename: string, content: string | ArrayBuffer, isBase64: boolean) {
    let dirHandle = this.activeLocalDirectoryHandle();
    if (!dirHandle) {
      if (!('showDirectoryPicker' in window)) {
        throw new Error('Local directory access not supported in this browser. Please download directly.');
      }
      dirHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
      this.activeLocalDirectoryHandle.set(dirHandle);
    }

    const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();

    if (isBase64 && typeof content === 'string') {
      const binary = atob(content);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      await writable.write(bytes);
    } else {
      await writable.write(content);
    }

    await writable.close();
  }

  // --- Encryption Envelope Helper ---

  private async encryptContainerWithPassword(plaintext: string, password: string): Promise<any> {
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();

    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    const aesKey = await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );

    const ciphertext = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      enc.encode(plaintext)
    );

    const checksum = await this.computeSha256(plaintext);

    return {
      format: 'eloqui-vault-encrypted',
      version: 1,
      kdf: 'PBKDF2-SHA256',
      iterations: 100000,
      cipher: 'AES-GCM-256',
      salt: btoa(String.fromCharCode(...salt)),
      iv: btoa(String.fromCharCode(...iv)),
      ciphertext: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
      timestamp: Date.now(),
      checksumSha256: checksum
    };
  }

  async decryptEncryptedContainer(envelope: any, password: string): Promise<string> {
    if (!envelope || envelope.format !== 'eloqui-vault-encrypted') {
      throw new Error('Invalid encrypted backup envelope');
    }

    const salt = Uint8Array.from(atob(envelope.salt), c => c.charCodeAt(0));
    const iv = Uint8Array.from(atob(envelope.iv), c => c.charCodeAt(0));
    const cipherBytes = Uint8Array.from(atob(envelope.ciphertext), c => c.charCodeAt(0));

    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    const aesKey = await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: envelope.iterations || 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    const decrypted = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      cipherBytes
    );

    return new TextDecoder().decode(decrypted);
  }

  // --- Disaster HTML Template Generator ---

  private generateDisasterHtmlReader(docs: Document[], timestamp: number): string {
    const dateStr = new Date(timestamp).toLocaleString();
    const docsHtml = docs.map((doc, dIdx) => {
      const chaptersHtml = (doc.chapters || []).map((ch, cIdx) => `
        <article class="chapter" id="doc-${dIdx}-ch-${cIdx}">
          <header class="chapter-header">
            <span class="chapter-num">Chapter ${cIdx + 1}</span>
            <h2 class="chapter-title">${ch.title || 'Untitled Chapter'}</h2>
          </header>
          <div class="chapter-body">
            ${ch.content || '<p><em>Empty chapter content.</em></p>'}
          </div>
        </article>
      `).join('');

      return `
        <section class="document-section" id="doc-${dIdx}">
          <h1 class="document-title">${doc.title || 'Untitled Document'}</h1>
          <div class="document-meta">Last modified: ${new Date(doc.lastModified || timestamp).toLocaleDateString()} | ${(doc.chapters || []).length} chapters</div>
          ${chaptersHtml}
        </section>
      `;
    }).join('<hr class="doc-divider" />');

    const tocHtml = docs.map((doc, dIdx) => `
      <div class="toc-doc">
        <a href="#doc-${dIdx}" class="toc-doc-title">${doc.title || 'Untitled Document'}</a>
        <ul class="toc-chapters">
          ${(doc.chapters || []).map((ch, cIdx) => `
            <li><a href="#doc-${dIdx}-ch-${cIdx}">Ch ${cIdx + 1}: ${ch.title}</a></li>
          `).join('')}
        </ul>
      </div>
    `).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Eloqui Disaster Recovery Vault Archive</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    :root {
      --bg: #fcfcfb;
      --text: #1a1a1a;
      --sidebar-bg: #f4f4f2;
      --border: #e2e2de;
      --accent: #581c87;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #0f0f11;
        --text: #e6e6e8;
        --sidebar-bg: #18181b;
        --border: #27272a;
        --accent: #a855f7;
      }
    }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      display: flex;
      min-height: 100vh;
    }
    aside {
      width: 280px;
      background: var(--sidebar-bg);
      border-right: 1px solid var(--border);
      padding: 24px 16px;
      box-sizing: border-box;
      position: sticky;
      top: 0;
      height: 100vh;
      overflow-y: auto;
    }
    main {
      flex: 1;
      max-width: 800px;
      margin: 0 auto;
      padding: 48px 32px;
      box-sizing: border-box;
    }
    h1.vault-heading {
      font-size: 16px;
      font-weight: 800;
      letter-spacing: -0.02em;
      margin: 0 0 4px 0;
      color: var(--accent);
    }
    .badge {
      display: inline-block;
      font-size: 10px;
      padding: 2px 6px;
      background: var(--accent);
      color: #fff;
      border-radius: 4px;
      font-weight: bold;
      text-transform: uppercase;
    }
    .meta-date {
      font-size: 11px;
      color: #71717a;
      margin-bottom: 20px;
    }
    .toc-doc {
      margin-bottom: 16px;
    }
    .toc-doc-title {
      font-weight: bold;
      font-size: 13px;
      text-decoration: none;
      color: inherit;
    }
    .toc-chapters {
      list-style: none;
      padding-left: 12px;
      margin: 6px 0 0 0;
      font-size: 12px;
    }
    .toc-chapters li {
      margin-bottom: 4px;
    }
    .toc-chapters a {
      color: #71717a;
      text-decoration: none;
    }
    .toc-chapters a:hover {
      color: var(--accent);
    }
    .document-title {
      font-size: 28px;
      font-family: Georgia, serif;
      margin: 40px 0 8px 0;
    }
    .document-meta {
      font-size: 12px;
      color: #71717a;
      margin-bottom: 32px;
      border-bottom: 1px solid var(--border);
      padding-bottom: 8px;
    }
    .chapter {
      margin-bottom: 48px;
    }
    .chapter-num {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--accent);
      font-weight: bold;
    }
    .chapter-title {
      font-size: 22px;
      font-family: Georgia, serif;
      margin: 4px 0 20px 0;
    }
    .chapter-body {
      font-family: Georgia, serif;
      font-size: 17px;
      line-height: 1.7;
    }
    .doc-divider {
      border: 0;
      border-top: 2px dashed var(--border);
      margin: 64px 0;
    }
    @media print {
      aside { display: none; }
      main { max-width: 100%; padding: 0; }
      .chapter { page-break-before: always; }
    }
  </style>
</head>
<body>
  <aside>
    <h1 class="vault-heading">ELOQUI EMERGENCY RECOVERY</h1>
    <span class="badge">Standalone Dump</span>
    <div class="meta-date">Snapshot: ${dateStr}</div>
    <div class="toc-container">
      ${tocHtml}
    </div>
  </aside>
  <main>
    ${docsHtml}
  </main>
</body>
</html>`;
  }

  // --- HTML to Clean Markdown ---

  private htmlToCleanMarkdown(html: string, title: string): string {
    let text = html
      .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
      .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
      .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
      .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
      .replace(/<li[^>]*>(.*?)<\/li>/gi, '* $1\n')
      .replace(/<ul[^>]*>/gi, '')
      .replace(/<\/ul>/gi, '\n')
      .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
      .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
      .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
      .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
      .replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, '> $1\n\n')
      .replace(/<br\s*[\/]?>/gi, '\n')
      .replace(/<hr\s*[\/]?>/gi, '\n---\n\n')
      .replace(/<[^>]*>/g, '');

    // Decode HTML entities
    text = text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ');

    return `# ${title}\n\n${text.trim()}\n`;
  }

  // --- Inspection & Restore Engine ---

  async inspectBackupFile(file: File, password?: string): Promise<BackupInspectionResult> {
    try {
      const filename = file.name.toLowerCase();

      // Check ZIP
      if (filename.endsWith('.zip')) {
        const zip = await JSZip.loadAsync(file);
        const manifestFile = zip.file('Manifest.json');
        if (manifestFile) {
          const manifestText = await manifestFile.async('text');
          const manifest = JSON.parse(manifestText);
          return {
            valid: true,
            format: 'zip',
            timestamp: manifest.timestamp,
            dateStr: manifest.exportedAt,
            docCount: manifest.totalDocuments || 0,
            chapterCount: manifest.totalChapters || 0,
            totalWords: manifest.totalWords || 0,
            docTitles: (manifest.documents || []).map((d: any) => d.title),
            requiresPassword: false,
            rawPayload: { zip, manifest }
          };
        }
      }

      // Check Text / JSON
      const text = await file.text();
      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch {
        return {
          valid: false,
          format: 'unknown',
          docCount: 0,
          chapterCount: 0,
          totalWords: 0,
          docTitles: [],
          error: 'File is not a valid JSON or ZIP archive'
        };
      }

      // Check if encrypted container
      if (parsed.format === 'eloqui-vault-encrypted') {
        if (!password) {
          return {
            valid: true,
            format: 'encrypted',
            timestamp: parsed.timestamp,
            dateStr: new Date(parsed.timestamp).toLocaleString(),
            docCount: 0,
            chapterCount: 0,
            totalWords: 0,
            docTitles: [],
            requiresPassword: true,
            rawPayload: parsed
          };
        }

        // Try decrypting with provided password
        try {
          const decryptedJson = await this.decryptEncryptedContainer(parsed, password);
          const decryptedPayload = JSON.parse(decryptedJson);
          const docs = decryptedPayload.documents || [];
          return {
            valid: true,
            format: 'encrypted',
            timestamp: parsed.timestamp,
            dateStr: new Date(parsed.timestamp).toLocaleString(),
            docCount: docs.length,
            chapterCount: docs.reduce((acc: number, d: any) => acc + (d.chapters?.length || 0), 0),
            totalWords: docs.reduce((acc: number, d: any) => {
              return acc + (d.chapters || []).reduce((cAcc: number, c: any) => {
                return cAcc + (c.content || '').replace(/<[^>]*>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
              }, 0);
            }, 0),
            docTitles: docs.map((d: any) => d.title || 'Untitled'),
            requiresPassword: false,
            rawPayload: decryptedPayload
          };
        } catch (e: any) {
          return {
            valid: false,
            format: 'encrypted',
            docCount: 0,
            chapterCount: 0,
            totalWords: 0,
            docTitles: [],
            requiresPassword: true,
            error: 'Incorrect decryption passphrase or damaged ciphertext'
          };
        }
      }

      // Unencrypted JSON vault
      if (parsed.documents && Array.isArray(parsed.documents)) {
        const docs = parsed.documents;
        return {
          valid: true,
          format: 'json',
          timestamp: parsed.createdAt || parsed.timestamp,
          dateStr: new Date(parsed.createdAt || parsed.timestamp || Date.now()).toLocaleString(),
          docCount: docs.length,
          chapterCount: docs.reduce((acc: number, d: any) => acc + (d.chapters?.length || 0), 0),
          totalWords: docs.reduce((acc: number, d: any) => {
            return acc + (d.chapters || []).reduce((cAcc: number, c: any) => {
              return cAcc + (c.content || '').replace(/<[^>]*>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
            }, 0);
          }, 0),
          docTitles: docs.map((d: any) => d.title || 'Untitled'),
          requiresPassword: false,
          rawPayload: parsed
        };
      }

      return {
        valid: false,
        format: 'unknown',
        docCount: 0,
        chapterCount: 0,
        totalWords: 0,
        docTitles: [],
        error: 'Unrecognized backup structure. Expected vault manifest or documents array.'
      };

    } catch (e: any) {
      return {
        valid: false,
        format: 'unknown',
        docCount: 0,
        chapterCount: 0,
        totalWords: 0,
        docTitles: [],
        error: e.message || 'Inspection failed'
      };
    }
  }

  async restoreVault(
    inspection: BackupInspectionResult,
    mode: 'merge' | 'replace'
  ): Promise<number> {
    if (!inspection.valid || !inspection.rawPayload) {
      throw new Error('Cannot restore invalid inspection payload');
    }

    let documentsToRestore: Document[] = [];

    if (inspection.format === 'zip') {
      // Unpack from ZIP
      const { zip, manifest } = inspection.rawPayload;
      for (const mDoc of (manifest.documents || [])) {
        const docFolderSafe = (mDoc.title || 'Untitled').replace(/[/\\?%*:|"<>]/g, '_').trim();
        const chapters: Chapter[] = [];

        for (let i = 0; i < (mDoc.chapters || []).length; i++) {
          const chInfo = mDoc.chapters[i];
          const chTitleSafe = (chInfo.title || `Chapter_${i + 1}`).replace(/[/\\?%*:|"<>]/g, '_').trim();
          const mdFile = zip.file(`Manuscripts/${docFolderSafe}/${String(i + 1).padStart(2, '0')}_${chTitleSafe}.md`);
          let htmlContent = '<p></p>';
          if (mdFile) {
            const mdText = await mdFile.async('text');
            htmlContent = mdText.split('\n\n').map((p: string) => `<p>${p.replace(/\n/g, '<br/>')}</p>`).join('');
          }
          chapters.push({
            id: chInfo.id || crypto.randomUUID(),
            title: chInfo.title,
            content: htmlContent,
            lastModified: Date.now()
          });
        }

        documentsToRestore.push({
          id: mDoc.id || crypto.randomUUID(),
          title: mDoc.title,
          lastModified: Date.now(),
          chapters
        });
      }
    } else {
      // JSON or decrypted payload
      documentsToRestore = inspection.rawPayload.documents || [];
    }

    if (documentsToRestore.length === 0) {
      throw new Error('No documents found in backup to restore');
    }

    await this.blockService.restoreVault(documentsToRestore, mode);

    this.privacy.logEvent({
      category: 'document',
      action: 'Vault Restored',
      details: `Restored ${documentsToRestore.length} documents from backup (${mode} mode)`,
      userEmail: 'current_user',
      status: 'processed'
    });

    return documentsToRestore.length;
  }

  // --- Utility Computations ---

  private async computeSha256(text: string): Promise<string> {
    const enc = new TextEncoder();
    const hash = await window.crypto.subtle.digest('SHA-256', enc.encode(text));
    const array = Array.from(new Uint8Array(hash));
    return array.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  getMethodLabel(method: BackupMethod): string {
    switch (method) {
      case 'encrypted_vault': return 'Full Encrypted Vault (AES-256)';
      case 'json_vault': return 'Plain JSON Vault Archive';
      case 'zip_bundle': return 'Multi-Folder Markdown ZIP';
      case 'incremental': return 'Incremental Delta Snapshot';
      case 'active_doc': return 'Active Document Only';
      case 'disaster_html': return 'Disaster Recovery HTML Reader';
      default: return method;
    }
  }

  getRemoteLabel(type: RemoteType): string {
    switch (type) {
      case 'download': return 'Direct Local Download';
      case 'local_dir': return 'Native Folder Sync (Directory API)';
      case 'github': return 'GitHub Repo / Gist';
      case 's3': return 'AWS S3 / Cloudflare R2 / MinIO';
      case 'webdav': return 'Nextcloud / ownCloud WebDAV';
      case 'webhook': return 'Custom Webhook / HTTP Endpoint';
      default: return type;
    }
  }
}
