import { Injectable, signal, computed, effect } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'system';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  readonly currentTheme = signal<ThemeMode>(this.getInitialTheme());
  private systemPrefersDark = signal<boolean>(this.checkSystemDark());

  readonly isDark = computed(() => {
    const t = this.currentTheme();
    if (t === 'dark') return true;
    if (t === 'light') return false;
    return this.systemPrefersDark();
  });

  constructor() {
    // Listen for OS system theme changes
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = (e: MediaQueryListEvent) => {
        this.systemPrefersDark.set(e.matches);
      };
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', listener);
      } else {
        mediaQuery.addListener(listener);
      }
    }

    // Synchronize DOM <html> class and meta color-scheme
    effect(() => {
      const dark = this.isDark();
      if (typeof document !== 'undefined') {
        const root = document.documentElement;
        if (dark) {
          root.classList.add('dark');
          root.style.colorScheme = 'dark';
        } else {
          root.classList.remove('dark');
          root.style.colorScheme = 'light';
        }
      }
    });
  }

  /**
   * Quick toggle between light and dark mode
   */
  toggleTheme() {
    const next = this.isDark() ? 'light' : 'dark';
    this.setTheme(next);
  }

  /**
   * Set specific theme mode ('light' | 'dark' | 'system')
   */
  setTheme(theme: ThemeMode) {
    this.currentTheme.set(theme);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('eloqui_theme', theme);
      } catch {
        // Ignore storage exceptions
      }
    }
  }

  private getInitialTheme(): ThemeMode {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const saved = localStorage.getItem('eloqui_theme') as ThemeMode;
        if (saved === 'light' || saved === 'dark' || saved === 'system') {
          return saved;
        }
      } catch {
        // Fallback
      }
    }
    return 'system';
  }

  private checkSystemDark(): boolean {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  }
}
