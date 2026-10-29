import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** The Ninno mark: a lowercase "n" on a square of the one hue. Optionally followed by the wordmark. */
@Component({
  selector: 'nn-mark',
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 28 28"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="28" height="28" rx="7" fill="var(--accent)" />
      <path
        d="M9 20V12.5a5 5 0 0 1 10 0V20M9 12.5V9"
        stroke="var(--on-accent)"
        stroke-width="2.6"
        fill="none"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
    @if (wordmark()) {
      <span class="text-lg font-bold tracking-tight">ninno</span>
    }
  `,
  host: {
    class: 'inline-flex items-center gap-2',
    role: 'img',
    '[attr.aria-label]': '"Ninno"',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NnMark {
  readonly size = input(28);
  readonly wordmark = input(false);
}
