import { Component, ChangeDetectionStrategy, inject, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService, UserRole } from '../../services/auth.service';

@Component({
  selector: 'app-auth-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div class="fixed inset-0 bg-black/40 backdrop-blur-sm" (click)="close.emit()"></div>

      <div class="relative w-full max-w-lg bg-white dark:bg-zinc-900 text-gray-800 dark:text-zinc-200 rounded-2xl shadow-2xl border border-gray-100 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        
        <!-- Header -->
        <div class="px-6 py-4 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between bg-gray-50/70 dark:bg-zinc-850/80">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 flex items-center justify-center font-bold">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <div>
              <h2 class="text-base font-semibold text-gray-900 dark:text-zinc-100">User Identity & Access Control</h2>
              <p class="text-xs text-gray-500 dark:text-zinc-400">Manage your profile, authentication, and RBAC permissions</p>
            </div>
          </div>
          
          <button (click)="close.emit()" class="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div class="overflow-y-auto p-6 space-y-5 flex-1">

          <!-- Current Active Profile Card -->
          <div class="p-4 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50/80 dark:bg-zinc-800/60 flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div 
                class="w-11 h-11 rounded-full text-white font-bold flex items-center justify-center text-sm shadow-sm"
                [style.backgroundColor]="authService.currentUser().avatarBg"
              >
                {{ authService.currentUser().name.charAt(0) }}
              </div>
              <div>
                <span class="text-sm font-bold text-gray-900 dark:text-zinc-100 block">{{ authService.currentUser().name }}</span>
                <span class="text-xs text-gray-500 dark:text-zinc-400">{{ authService.currentUser().email }}</span>
              </div>
            </div>

            <div class="text-right">
              <span class="px-2.5 py-1 text-[11px] font-semibold rounded-full uppercase"
                [class.bg-purple-100]="authService.currentUser().role === 'admin'"
                [class.text-purple-800]="authService.currentUser().role === 'admin'"
                [class.dark:bg-purple-950/60]="authService.currentUser().role === 'admin'"
                [class.dark:text-purple-300]="authService.currentUser().role === 'admin'"
                [class.bg-emerald-100]="authService.currentUser().role === 'writer'"
                [class.text-emerald-800]="authService.currentUser().role === 'writer'"
                [class.dark:bg-emerald-950/60]="authService.currentUser().role === 'writer'"
                [class.dark:text-emerald-300]="authService.currentUser().role === 'writer'"
                [class.bg-amber-100]="authService.currentUser().role === 'reviewer'"
                [class.text-amber-800]="authService.currentUser().role === 'reviewer'"
                [class.dark:bg-amber-950/60]="authService.currentUser().role === 'reviewer'"
                [class.dark:text-amber-300]="authService.currentUser().role === 'reviewer'"
              >
                {{ authService.roleLabel() }}
              </span>
            </div>
          </div>

          <!-- Quick Persona Switcher (RBAC Tester) -->
          <div class="border border-gray-100 dark:border-zinc-700/80 rounded-xl p-4 bg-white dark:bg-zinc-850 space-y-2.5">
            <span class="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-zinc-300 block">Switch Active Role & Persona</span>
            <div class="grid grid-cols-3 gap-2">
              @for (user of authService.allUsers(); track user.id) {
                <button
                  (click)="authService.switchProfile(user.id)"
                  [class.border-purple-500]="authService.currentUser().id === user.id"
                  [class.bg-purple-50/40]="authService.currentUser().id === user.id"
                  [class.dark:bg-purple-950/40]="authService.currentUser().id === user.id"
                  class="p-2.5 rounded-lg border border-gray-200 dark:border-zinc-700 text-left hover:border-gray-300 dark:hover:border-zinc-600 transition-all flex flex-col justify-between cursor-pointer"
                >
                  <span class="text-xs font-semibold text-gray-800 dark:text-zinc-200 truncate block">{{ user.name }}</span>
                  <span class="text-[10px] font-medium text-gray-500 dark:text-zinc-400 uppercase mt-1">{{ user.role }}</span>
                </button>
              }
            </div>
          </div>

          <!-- Permissions Matrix for Current Role -->
          <div class="border border-gray-100 dark:border-zinc-700/80 rounded-xl p-4 bg-gray-50/60 dark:bg-zinc-800/50 space-y-2">
            <span class="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-zinc-300 block">Current Role Permissions</span>
            <ul class="text-xs space-y-1.5 text-gray-600 dark:text-zinc-400">
              <li class="flex items-center gap-2">
                <span [class.text-emerald-600]="authService.canEdit()" [class.dark:text-emerald-400]="authService.canEdit()" [class.text-red-400]="!authService.canEdit()">
                  {{ authService.canEdit() ? '✓' : '✗' }}
                </span>
                Edit documents and Notion blocks
              </li>
              <li class="flex items-center gap-2">
                <span [class.text-emerald-600]="authService.canManageModels()" [class.dark:text-emerald-400]="authService.canManageModels()" [class.text-red-400]="!authService.canManageModels()">
                  {{ authService.canManageModels() ? '✓' : '✗' }}
                </span>
                Manage custom models and API endpoints
              </li>
              <li class="flex items-center gap-2">
                <span [class.text-emerald-600]="authService.canManageBYOK()" [class.dark:text-emerald-400]="authService.canManageBYOK()" [class.text-red-400]="!authService.canManageBYOK()">
                  {{ authService.canManageBYOK() ? '✓' : '✗' }}
                </span>
                Configure BYOK & master encryption keys
              </li>
              <li class="flex items-center gap-2">
                <span [class.text-emerald-600]="authService.canAccessPrivacy()" [class.dark:text-emerald-400]="authService.canAccessPrivacy()" [class.text-red-400]="!authService.canAccessPrivacy()">
                  {{ authService.canAccessPrivacy() ? '✓' : '✗' }}
                </span>
                Access Privacy Dashboard & Audit Trail
              </li>
            </ul>
          </div>

          <!-- Register / Add New User -->
          @if (!isAddingUser()) {
            <button
              (click)="isAddingUser.set(true)"
              class="w-full py-2 border border-dashed border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 text-xs font-semibold rounded-lg hover:border-gray-400 dark:hover:border-zinc-500 hover:text-gray-800 dark:hover:text-zinc-200 transition-colors cursor-pointer"
            >
              + Register New Account
            </button>
          } @else {
            <div class="border border-purple-200 dark:border-purple-800 bg-purple-50/20 dark:bg-purple-950/20 p-4 rounded-xl space-y-3 animate-in fade-in duration-150">
              <span class="text-xs font-bold text-purple-950 dark:text-purple-300 uppercase">Create New Profile</span>
              <div class="space-y-2 text-xs">
                <div>
                  <label class="block text-gray-700 dark:text-zinc-300 font-medium mb-1">Full Name</label>
                  <input type="text" [(ngModel)]="newName" placeholder="Jane Doe" class="w-full p-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 text-xs"/>
                </div>
                <div>
                  <label class="block text-gray-700 dark:text-zinc-300 font-medium mb-1">Email</label>
                  <input type="email" [(ngModel)]="newEmail" placeholder="jane@example.com" class="w-full p-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 text-xs"/>
                </div>
                <div>
                  <label class="block text-gray-700 dark:text-zinc-300 font-medium mb-1">Role</label>
                  <select [(ngModel)]="newRole" class="w-full p-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 text-xs">
                    <option value="admin">Owner / Admin</option>
                    <option value="writer">Writer / Editor</option>
                    <option value="reviewer">Reviewer / Proofreader</option>
                  </select>
                </div>
              </div>

              <div class="flex justify-end gap-2 pt-2">
                <button (click)="isAddingUser.set(false)" class="px-3 py-1.5 text-xs text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg">Cancel</button>
                <button (click)="handleSignUp()" class="px-4 py-1.5 text-xs font-semibold bg-purple-600 text-white hover:bg-purple-700 rounded-lg">Sign Up</button>
              </div>
            </div>
          }

        </div>

        <!-- Footer -->
        <div class="px-6 py-3.5 bg-gray-50 dark:bg-zinc-900 border-t border-gray-100 dark:border-zinc-800 flex justify-end">
          <button (click)="close.emit()" class="px-4 py-2 text-xs font-semibold bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg hover:bg-gray-800 dark:hover:bg-white transition-colors cursor-pointer">
            Done
          </button>
        </div>

      </div>
    </div>
  `
})
export class AuthModalComponent {
  authService = inject(AuthService);
  @Output() close = new EventEmitter<void>();

  isAddingUser = signal<boolean>(false);
  newName = '';
  newEmail = '';
  newRole: UserRole = 'writer';

  handleSignUp() {
    if (!this.newName.trim() || !this.newEmail.trim()) {
      alert('Please fill in name and email');
      return;
    }
    this.authService.signUp(this.newName, this.newEmail, this.newRole);
    this.isAddingUser.set(false);
    this.newName = '';
    this.newEmail = '';
  }
}
