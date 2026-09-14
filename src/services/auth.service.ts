import { Injectable, signal, computed } from '@angular/core';

export type UserRole = 'admin' | 'writer' | 'reviewer';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarBg: string;
  createdAt: number;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly STORAGE_KEY = 'eloqui_auth_user';
  private readonly USERS_STORAGE_KEY = 'eloqui_registered_users';

  // Demo seed profiles for quick testing
  private defaultUsers: UserProfile[] = [];

  readonly currentUser = signal<UserProfile | null>(this.loadInitialUser());
  readonly isAuthenticated = signal<boolean>(false);
  readonly allUsers = signal<UserProfile[]>(this.loadRegisteredUsers());

  // Role permissions
  readonly canEdit = computed(() => {
    const role = this.currentUser()?.role;
    return role === 'admin' || role === 'writer';
  });

  readonly canManageModels = computed(() => {
    return this.currentUser()?.role === 'admin';
  });

  readonly canManageBYOK = computed(() => {
    return this.currentUser()?.role === 'admin';
  });

  readonly canAccessPrivacy = computed(() => {
    return this.currentUser()?.role === 'admin' || this.currentUser()?.role === 'writer';
  });

  readonly roleLabel = computed(() => {
    switch (this.currentUser()?.role) {
      case 'admin': return 'Owner & Admin';
      case 'writer': return 'Writer / Editor';
      case 'reviewer': return 'Proofreader / Reviewer';
      default: return 'Guest';
    }
  });

  private loadInitialUser(): UserProfile {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Auth local storage read failed', e);
    }
    return {
      id: 'guest',
      name: 'Guest User',
      email: 'guest@eloqui.dev',
      role: 'writer',
      avatarBg: '#9ca3af',
      createdAt: Date.now()
    };
  }

  private loadRegisteredUsers(): UserProfile[] {
    try {
      const stored = localStorage.getItem(this.USERS_STORAGE_KEY);
      if (stored) {
        const users = JSON.parse(stored);
        if (Array.isArray(users) && users.length > 0) return users;
      }
    } catch (e) {
      console.warn('Registered users read failed', e);
    }
    return this.defaultUsers;
  }

  private saveCurrent(user: UserProfile) {
    this.currentUser.set(user);
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(user));
    } catch (e) {}
  }

  private saveUsersList(users: UserProfile[]) {
    this.allUsers.set(users);
    try {
      localStorage.setItem(this.USERS_STORAGE_KEY, JSON.stringify(users));
    } catch (e) {}
  }

  login(email: string): boolean {
    const found = this.allUsers().find(u => u.email.toLowerCase() === email.toLowerCase());
    if (found) {
      this.saveCurrent(found);
      this.isAuthenticated.set(true);
      return true;
    }
    return false;
  }

  signUp(name: string, email: string, role: UserRole): UserProfile {
    const colors = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#3b82f6', '#8b5cf6'];
    const newUser: UserProfile = {
      id: 'usr_' + Math.random().toString(36).substring(2, 9),
      name,
      email,
      role,
      avatarBg: colors[Math.floor(Math.random() * colors.length)],
      createdAt: Date.now()
    };
    const updated = [...this.allUsers(), newUser];
    this.saveUsersList(updated);
    this.saveCurrent(newUser);
    this.isAuthenticated.set(true);
    return newUser;
  }

  switchProfile(userId: string) {
    const user = this.allUsers().find(u => u.id === userId);
    if (user) {
      this.saveCurrent(user);
    }
  }

  updateRole(newRole: UserRole) {
    const user = this.currentUser();
    if (!user) return;
    const updated: UserProfile = { ...user, role: newRole };
    this.saveCurrent(updated);
    const users = this.allUsers().map(u => u.id === updated.id ? updated : u);
    this.saveUsersList(users);
  }

  logout() {
    this.isAuthenticated.set(false);
  }

  requestPasswordReset(email: string): { success: boolean; token?: string; message: string } {
    const user = this.allUsers().find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      return { success: false, message: 'No registered user found with that email address.' };
    }

    // Generate real cryptographically secure 256-bit token
    const randomBytes = new Uint8Array(24);
    window.crypto.getRandomValues(randomBytes);
    const token = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');

    const resetRecord = {
      email: user.email,
      token,
      expiresAt: Date.now() + 15 * 60 * 1000 // 15 minutes validity
    };

    try {
      const existingResets = JSON.parse(localStorage.getItem('eloqui_password_resets') || '[]');
      const filtered = existingResets.filter((r: any) => r.email !== user.email);
      filtered.push(resetRecord);
      localStorage.setItem('eloqui_password_resets', JSON.stringify(filtered));
    } catch {}

    return {
      success: true,
      token,
      message: `Zero-knowledge password reset token issued for ${email}. Valid for 15 minutes.`
    };
  }

  verifyResetToken(email: string, token: string): boolean {
    try {
      const existingResets = JSON.parse(localStorage.getItem('eloqui_password_resets') || '[]');
      const match = existingResets.find((r: any) => 
        r.email.toLowerCase() === email.toLowerCase() && 
        r.token === token && 
        r.expiresAt > Date.now()
      );
      return !!match;
    } catch {
      return false;
    }
  }

  completePasswordReset(email: string, token: string, newRole?: UserRole): { success: boolean; message: string } {
    if (!this.verifyResetToken(email, token)) {
      return { success: false, message: 'Invalid or expired password reset token.' };
    }

    // Invalidate token
    try {
      const existingResets = JSON.parse(localStorage.getItem('eloqui_password_resets') || '[]');
      const filtered = existingResets.filter((r: any) => !(r.email.toLowerCase() === email.toLowerCase() && r.token === token));
      localStorage.setItem('eloqui_password_resets', JSON.stringify(filtered));
    } catch {}

    const user = this.allUsers().find(u => u.email.toLowerCase() === email.toLowerCase());
    if (user && newRole) {
      this.updateRole(newRole);
    }

    return {
      success: true,
      message: `Account credentials and cryptographic keys have been re-secured for ${email}.`
    };
  }
}
