import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NnButton, NnIcon, NnMark } from '@ninno/ui';
import { AppUpdateService, InstallPromptService, NetworkService } from './pwa.services';

/** "A new version of Ninno is ready": never reloads by itself while someone is working. */
@Component({
  selector: 'nn-update-banner',
  imports: [NnButton],
  template: `
    @if (updates.ready()) {
      <div
        class="flex items-center justify-between gap-3 border-b border-border bg-accent-soft px-4 py-2 text-sm text-accent-ink"
        role="status"
      >
        <span i18n>A new version of Ninno is ready.</span>
        <button nnButton variant="text" type="button" (click)="updates.reload()" i18n>
          Reload
        </button>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UpdateBanner {
  protected readonly updates = inject(AppUpdateService);
}

/** Bottom card offering installation, once per device. */
@Component({
  selector: 'nn-install-banner',
  imports: [NnButton, NnIcon, NnMark],
  template: `
    @if (install.mode(); as mode) {
      <aside
        class="fixed inset-x-4 bottom-[calc(84px+env(safe-area-inset-bottom))] z-20 mx-auto max-w-md rounded-card border border-border bg-surface p-4 shadow-[0_8px_24px_rgb(0_0_0/0.14)]"
        aria-labelledby="install-title"
      >
        <div class="flex items-start gap-3">
          <nn-mark [size]="36" />
          <div class="flex-1">
            <p id="install-title" class="font-semibold" i18n>Add Ninno to your home screen</p>
            @if (mode === 'ios') {
              <p class="mt-1 text-sm text-muted" i18n>
                In Safari, tap Share, then “Add to Home Screen”.
              </p>
            } @else {
              <p class="mt-1 text-sm text-muted" i18n>
                Open it like an app, even on a slow connection.
              </p>
            }
          </div>
          <button
            type="button"
            class="-mr-2 -mt-2 grid size-11 place-items-center rounded-control text-muted"
            aria-label="Not now"
            i18n-aria-label
            (click)="install.dismiss()"
          >
            <nn-icon name="close" [size]="18" />
          </button>
        </div>
        @if (mode === 'prompt') {
          <button
            nnButton
            type="button"
            class="mt-3"
            [block]="true"
            (click)="install.install()"
            i18n
          >
            Add to home screen
          </button>
        }
      </aside>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InstallBanner {
  protected readonly install = inject(InstallPromptService);
}

/** Shown over the app when the device is offline; the app shell itself loads from the cache. */
@Component({
  selector: 'nn-offline-screen',
  imports: [NnButton, NnIcon],
  template: `
    @if (!network.online()) {
      <main
        class="fixed inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-ground px-6 text-center"
        role="alert"
      >
        <nn-icon name="offline" [size]="40" class="text-muted" />
        <h1 class="text-2xl font-bold" i18n>You're offline</h1>
        <p class="max-w-xs text-muted" i18n>
          Ninno needs a connection to load your hostel. Check your mobile data or Wi-Fi.
        </p>
        <button nnButton type="button" (click)="retry()" i18n>Retry</button>
        @if (stillOffline()) {
          <p class="text-sm text-muted" aria-live="polite" i18n>Still no connection.</p>
        }
      </main>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfflineScreen {
  protected readonly network = inject(NetworkService);
  protected readonly stillOffline = signal(false);

  protected retry(): void {
    if (navigator.onLine) {
      document.location.reload();
    } else {
      this.stillOffline.set(true);
    }
  }
}
