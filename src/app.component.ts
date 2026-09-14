import { Component, ChangeDetectionStrategy, inject, ViewChild, ElementRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BlockService } from './services/block.service';
import { ImportService } from './services/import.service';
import { AuthService } from './services/auth.service';
import { CryptoService } from './services/crypto.service';
import { ModelService } from './services/model.service';
import { PrivacyService } from './services/privacy.service';
import { EditorComponent } from './components/editor/editor.component';
import { ChatComponent } from './components/chat/chat.component';
import { MetricsModalComponent } from './components/metrics-modal/metrics-modal.component';
import { ModelsModalComponent } from './components/models-modal/models-modal.component';
import { ByokModalComponent } from './components/byok-modal/byok-modal.component';
import { PrivacyModalComponent } from './components/privacy-modal/privacy-modal.component';
import { AuthModalComponent } from './components/auth-modal/auth-modal.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    EditorComponent,
    ChatComponent,
    MetricsModalComponent,
    ModelsModalComponent,
    ByokModalComponent,
    PrivacyModalComponent,
    AuthModalComponent
  ],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(window:keydown)': 'handleKeyboardShortcuts($event)'
  }
})
export class AppComponent {
  blockService = inject(BlockService);
  importService = inject(ImportService);
  authService = inject(AuthService);
  cryptoService = inject(CryptoService);
  modelService = inject(ModelService);
  privacyService = inject(PrivacyService);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild(EditorComponent) editorComponent!: EditorComponent;
  
  showLeftSidebar = signal(true);
  showRightSidebar = signal(true);
  showMobileMenu = signal(false);
  showMobileChat = signal(false);
  showToolsMenu = signal(false);
  isFocusMode = signal(false);
  isLoadingSample = signal(false);
  importStatusMessage = signal<string | null>(null);

  // Modal Control Signals
  showMetricsModal = signal(false);
  showModelsModal = signal(false);
  showByokModal = signal(false);
  showPrivacyModal = signal(false);
  showAuthModal = signal(false);

  toggleToolsMenu() {
    this.showToolsMenu.update(v => !v);
  }

  closeToolsMenu() {
    this.showToolsMenu.set(false);
  }

  openModal(modal: 'metrics' | 'models' | 'byok' | 'privacy' | 'auth') {
    this.showToolsMenu.set(false);
    this.showMobileMenu.set(false);
    if (modal === 'metrics') this.showMetricsModal.set(true);
    if (modal === 'models') this.showModelsModal.set(true);
    if (modal === 'byok') this.showByokModal.set(true);
    if (modal === 'privacy') this.showPrivacyModal.set(true);
    if (modal === 'auth') this.showAuthModal.set(true);
  }

  toggleLeftSidebar() {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      this.showMobileMenu.update(v => !v);
      if (this.showMobileMenu()) {
        this.showMobileChat.set(false);
        this.showToolsMenu.set(false);
      }
    } else {
      this.showLeftSidebar.update(v => !v);
    }
  }

  toggleRightSidebar() {
    if (typeof window !== 'undefined' && window.innerWidth < 1280) {
      this.showMobileChat.update(v => !v);
      if (this.showMobileChat()) {
        this.showMobileMenu.set(false);
        this.showToolsMenu.set(false);
      }
    } else {
      this.showRightSidebar.update(v => !v);
    }
  }

  handleKeyboardShortcuts(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      if (this.showToolsMenu()) {
        this.showToolsMenu.set(false);
        return;
      }
      if (this.showMobileMenu()) {
        this.showMobileMenu.set(false);
        return;
      }
      if (this.showMobileChat()) {
        this.showMobileChat.set(false);
        return;
      }
    }
    // Ctrl+\ or Cmd+\ toggles Left Sidebar (Library/Chapters)
    if ((event.ctrlKey || event.metaKey) && event.key === '\\') {
      event.preventDefault();
      this.toggleLeftSidebar();
    }
    // Ctrl+J or Cmd+J toggles Right Sidebar (AI Assistant)
    if ((event.ctrlKey || event.metaKey) && (event.key === 'j' || event.key === 'J')) {
      event.preventDefault();
      this.toggleRightSidebar();
    }
  }

  triggerImport() {
    this.fileInput.nativeElement.click();
    this.showMobileMenu.set(false);
  }

  async handleImport(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      try {
        this.importStatusMessage.set(`Importing ${file.name}...`);
        const result = await this.importService.importFile(file);
        await this.blockService.createDocumentFromImport(result.title, result.chapters);
        this.importStatusMessage.set(`Successfully imported "${result.title}"!`);
        setTimeout(() => this.importStatusMessage.set(null), 4000);
      } catch (e) {
        console.error('Import failed', e);
        this.importStatusMessage.set('Failed to import file. Please ensure it is a valid .epub or .txt file.');
        setTimeout(() => this.importStatusMessage.set(null), 5000);
      } finally {
        input.value = '';
      }
    }
  }

  async loadSampleEpub() {
    this.isLoadingSample.set(true);
    this.importStatusMessage.set('Loading sample AO3 EPUB...');
    try {
      const resp = await fetch('/sample.epub');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      const file = new File([blob], 'Isekaied to Save the Empire’s Financial Situation.epub', { type: 'application/epub+zip' });
      const result = await this.importService.importFile(file);
      await this.blockService.createDocumentFromImport(result.title, result.chapters);
      this.importStatusMessage.set('Loaded sample AO3 book with metadata & chapters!');
      setTimeout(() => this.importStatusMessage.set(null), 4000);
    } catch (e) {
      console.error('Failed to load sample epub', e);
      this.importStatusMessage.set('Could not load sample EPUB from server.');
      setTimeout(() => this.importStatusMessage.set(null), 4000);
    } finally {
      this.isLoadingSample.set(false);
      this.showMobileMenu.set(false);
    }
  }

  async handleDrop(event: DragEvent) {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.name.endsWith('.epub') || file.name.endsWith('.txt')) {
        try {
          this.importStatusMessage.set(`Importing ${file.name}...`);
          const result = await this.importService.importFile(file);
          await this.blockService.createDocumentFromImport(result.title, result.chapters);
          this.importStatusMessage.set(`Successfully imported "${result.title}"!`);
          setTimeout(() => this.importStatusMessage.set(null), 4000);
        } catch (err) {
          console.error('Drop import error', err);
          this.importStatusMessage.set('Import failed. Please check file format.');
          setTimeout(() => this.importStatusMessage.set(null), 4000);
        }
      }
    }
  }

  selectDocument(id: string) {
    this.blockService.selectDocument(id);
    this.showMobileMenu.set(false);
  }
  
  selectChapter(id: string) {
    this.blockService.selectChapter(id);
    this.showMobileMenu.set(false);
  }

  createNewDoc() {
    this.blockService.createNewDocument();
    this.showMobileMenu.set(false);
  }

  deleteDoc(id: string, event: Event) {
    event.stopPropagation();
    this.blockService.deleteDocument(id);
  }

  handleFocusMode(active: boolean) {
    this.isFocusMode.set(active);
  }
}
