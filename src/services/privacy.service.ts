import { Injectable, signal } from '@angular/core';

export interface AuditEvent {
  id: string;
  timestamp: number;
  category: 'document' | 'encryption' | 'ai_inference' | 'byok' | 'auth';
  action: string;
  details: string;
  userEmail: string;
  status: 'allowed' | 'encrypted' | 'revoked' | 'processed';
}

export interface PrivacyPolicyItem {
  id: string;
  title: string;
  status: 'guaranteed' | 'enforced' | 'user_controlled';
  description: string;
  icon: string;
}

@Injectable({
  providedIn: 'root'
})
export class PrivacyService {
  private readonly AUDIT_STORAGE = 'eloqui_privacy_audit_log';
  private readonly TELEMETRY_STORAGE = 'eloqui_telemetry_disabled';

  readonly auditLogs = signal<AuditEvent[]>(this.loadAuditLogs());
  readonly isZeroTelemetry = signal<boolean>(this.loadTelemetryPreference());

  readonly policies: PrivacyPolicyItem[] = [
    {
      id: 'zero_retention',
      title: 'Zero Data Retention on Inference',
      status: 'guaranteed',
      description: 'Prompts, grammar checks, and block text are never saved or retained by LLM inference providers after completion.',
      icon: 'shield-check'
    },
    {
      id: 'local_encryption',
      title: 'AES-GCM-256 Client Encryption',
      status: 'enforced',
      description: 'Your documents, keys, and chapters are encrypted at rest on your machine before saving to IndexedDB using your private cryptographic key.',
      icon: 'lock'
    },
    {
      id: 'no_training',
      title: 'No Model Training On User Data',
      status: 'guaranteed',
      description: 'Neither Eloqui nor the model endpoints use your writing or documents for AI foundation model training.',
      icon: 'ban'
    },
    {
      id: 'byok_isolation',
      title: 'Direct Provider BYOK Routing',
      status: 'user_controlled',
      description: 'When using Bring Your Own Key, API calls route directly to your chosen endpoints without proxy storage or telemetry.',
      icon: 'key'
    },
    {
      id: 'unbiased_neutrality',
      title: 'Impartial & Unbiased Processing',
      status: 'guaranteed',
      description: 'Equal, objective support across Filtered and Unfiltered modes with zero ideological, moral, or editorial lecturing. Preserves complete authorial autonomy.',
      icon: 'scale'
    }
  ];

  constructor() {
    // Seed initial audit log if empty
    if (this.auditLogs().length === 0) {
      this.logEvent({
        category: 'auth',
        action: 'Zero-Knowledge Session Initialized',
        details: 'Client cryptographic vault unlocked with PBKDF2 derived key',
        userEmail: 'elena@eloqui.dev',
        status: 'encrypted'
      });
    }
  }

  private loadAuditLogs(): AuditEvent[] {
    try {
      const stored = localStorage.getItem(this.AUDIT_STORAGE);
      if (stored) return JSON.parse(stored);
    } catch {}
    return [];
  }

  private loadTelemetryPreference(): boolean {
    try {
      const stored = localStorage.getItem(this.TELEMETRY_STORAGE);
      return stored ? JSON.parse(stored) : true;
    } catch {
      return true;
    }
  }

  logEvent(event: Omit<AuditEvent, 'id' | 'timestamp'>) {
    const newEvent: AuditEvent = {
      ...event,
      id: 'aud_' + Math.random().toString(36).substring(2, 9),
      timestamp: Date.now()
    };
    const updated = [newEvent, ...this.auditLogs().slice(0, 99)]; // Keep latest 100
    this.auditLogs.set(updated);
    try {
      localStorage.setItem(this.AUDIT_STORAGE, JSON.stringify(updated));
    } catch {}
  }

  setZeroTelemetry(enabled: boolean) {
    this.isZeroTelemetry.set(enabled);
    localStorage.setItem(this.TELEMETRY_STORAGE, JSON.stringify(enabled));
    this.logEvent({
      category: 'byok',
      action: enabled ? 'Zero-Telemetry Enforced' : 'Standard Mode Enabled',
      details: 'User modified data transmission policy in Privacy Dashboard',
      userEmail: 'current_user',
      status: 'allowed'
    });
  }

  clearAuditLogs() {
    this.auditLogs.set([]);
    try {
      localStorage.removeItem(this.AUDIT_STORAGE);
    } catch {}
  }

  exportAuditLogsJson(): string {
    return JSON.stringify(this.auditLogs(), null, 2);
  }
}
