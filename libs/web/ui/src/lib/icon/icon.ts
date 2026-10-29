import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** One small outline set (1.6px stroke, 24px grid), inline so nothing extra downloads. */
const PATHS = {
  home: 'M4 10.5 12 4l8 6.5V20H4z',
  payments: 'M4 5h16v14H4zM4 10h16',
  profile: 'M12 12.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM5 20c1.2-3.5 4-5 7-5s5.8 1.5 7 5',
  residents:
    'M9 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 19c.8-3 3.2-4.5 6-4.5s5.2 1.5 6 4.5M16 6.5a3 3 0 0 1 0 5.5M18 14.8c1.6.6 2.6 2 3 4.2',
  beds: 'M3 18V8M21 18v-5H3M7 13v-2.5a1.5 1.5 0 0 1 1.5-1.5H11a1 1 0 0 1 1 1v3',
  approvals: 'M9 12.5l2 2 4-4.5M5 4h14v16H5z',
  settings:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2-1.2L14.2 3h-4l-.4 2.6a7 7 0 0 0-2 1.2l-2.4-.9-2 3.4 2 1.5A7 7 0 0 0 5 12a7 7 0 0 0 .1 1.2l-2 1.5 2 3.4 2.4-.9a7 7 0 0 0 2 1.2l.4 2.6h4l.4-2.6a7 7 0 0 0 2-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z',
  more: 'M5 10.75a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 1 0 0-2.5zM12 10.75a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 1 0 0-2.5zM19 10.75a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 1 0 0-2.5z',
  signOut: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  offline:
    'M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 4-2.4M12 20h.01M19 13a10 10 0 0 0-2.7-1.8M2 9.5a15 15 0 0 1 4.2-2.7M22 9.5A15 15 0 0 0 11 5.1',
  close: 'M6 6l12 12M18 6 6 18',
  install: 'M12 4v11M7.5 10.5 12 15l4.5-4.5M5 20h14',
  chevronLeft: 'M15 5l-7 7 7 7',
} as const;

export type IconName = keyof typeof PATHS;

@Component({
  selector: 'nn-icon',
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path [attr.d]="path()" />
    </svg>
  `,
  host: { class: 'inline-flex shrink-0' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NnIcon {
  readonly name = input.required<IconName>();
  readonly size = input(20);
  protected readonly path = computed(() => PATHS[this.name()]);
}
