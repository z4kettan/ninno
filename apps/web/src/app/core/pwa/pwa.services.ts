import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { SwUpdate, type VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs';

/** Chrome's install event (not in the TS DOM lib). */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const INSTALL_DISMISSED_KEY = 'ninno.install.dismissed';

/** Per-device convenience flags; storage can be blocked (private mode), so never throw. */
const storage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // ignore: the prompt may just show again next time
    }
  },
};

export type InstallMode = 'prompt' | 'ios' | null;

/**
 * "Add Ninno to your home screen", shown once per device. Chrome offers a real prompt
 * (beforeinstallprompt); iOS Safari has none, so it gets the manual steps instead.
 */
@Injectable({ providedIn: 'root' })
export class InstallPromptService {
  private deferred: BeforeInstallPromptEvent | null = null;
  readonly mode = signal<InstallMode>(null);

  constructor() {
    if (typeof window === 'undefined' || this.dismissed() || isStandalone()) {
      return;
    }
    const onPrompt = (event: Event) => {
      event.preventDefault();
      this.deferred = event as BeforeInstallPromptEvent;
      this.mode.set('prompt');
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', () => this.dismiss());
    inject(DestroyRef).onDestroy(() => window.removeEventListener('beforeinstallprompt', onPrompt));
    if (isIosSafari()) {
      this.mode.set('ios');
    }
  }

  async install(): Promise<void> {
    const event = this.deferred;
    if (!event) {
      return;
    }
    await event.prompt();
    await event.userChoice;
    this.deferred = null;
    this.dismiss();
  }

  dismiss(): void {
    storage.set(INSTALL_DISMISSED_KEY, '1');
    this.mode.set(null);
  }

  private dismissed(): boolean {
    return storage.get(INSTALL_DISMISSED_KEY) === '1';
  }
}

/** A new build has been downloaded in the background; the user chooses when to reload. */
@Injectable({ providedIn: 'root' })
export class AppUpdateService {
  readonly ready = signal(false);

  constructor() {
    const updates = inject(SwUpdate);
    if (!updates.isEnabled) {
      return;
    }
    updates.versionUpdates
      .pipe(filter((e): e is VersionReadyEvent => e.type === 'VERSION_READY'))
      .subscribe(() => this.ready.set(true));
  }

  reload(): void {
    document.location.reload();
  }
}

/** Online/offline from the browser, as a signal. */
@Injectable({ providedIn: 'root' })
export class NetworkService {
  readonly online = signal(typeof navigator === 'undefined' ? true : navigator.onLine);

  constructor() {
    if (typeof window === 'undefined') {
      return;
    }
    const up = () => this.online.set(true);
    const down = () => this.online.set(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    });
  }
}

function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  const ios =
    /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
  return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
}
