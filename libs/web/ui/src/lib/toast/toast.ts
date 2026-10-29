import { ChangeDetectionStrategy, Component, Injectable, inject, signal } from '@angular/core';
import { NnIcon } from '../icon/icon';

export type ToastTone = 'neutral' | 'success' | 'error';

export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

const DISMISS_AFTER_MS = 4000;

/** Short confirmations ("Saved") and non-blocking errors. Inline errors stay next to their field. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 0;
  readonly toasts = signal<Toast[]>([]);

  show(message: string, tone: ToastTone = 'neutral'): void {
    const toast: Toast = { id: this.nextId++, message, tone };
    this.toasts.update((list) => [...list.slice(-2), toast]);
    setTimeout(() => this.dismiss(toast.id), DISMISS_AFTER_MS);
  }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }
}

/** Place once in the app root. A polite live region, so screen readers announce each toast. */
@Component({
  selector: 'nn-toast-host',
  imports: [NnIcon],
  template: `
    @for (toast of service.toasts(); track toast.id) {
      <div
        class="pointer-events-auto flex min-h-11 items-center gap-3 rounded-card px-4 py-2 text-sm font-medium shadow-[0_8px_24px_rgb(0_0_0/0.18)]"
        [class.bg-text]="toast.tone !== 'error'"
        [class.text-surface]="toast.tone !== 'error'"
        [class.bg-negative]="toast.tone === 'error'"
        [class.text-white]="toast.tone === 'error'"
      >
        <span class="flex-1">{{ toast.message }}</span>
        <button
          type="button"
          class="-mr-2 grid size-11 place-items-center rounded-control"
          aria-label="Dismiss"
          i18n-aria-label
          (click)="service.dismiss(toast.id)"
        >
          <nn-icon name="close" [size]="18" />
        </button>
      </div>
    }
  `,
  host: {
    class:
      'pointer-events-none fixed inset-x-4 bottom-[calc(76px+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-md flex-col gap-2',
    role: 'status',
    'aria-live': 'polite',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NnToastHost {
  protected readonly service = inject(ToastService);
}
