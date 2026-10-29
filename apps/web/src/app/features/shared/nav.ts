import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { type IconName, NnIcon } from '@ninno/ui';

export interface NavItem {
  label: string;
  icon: IconName;
  link: string;
  /** Match the link exactly (for area roots like "/admin"). */
  exact?: boolean;
  /** A count to show next to the label (e.g. applications waiting); hidden when 0. */
  badge?: number;
}

/**
 * Bottom tab bar for phones. The active tab is the hue's pale tint with its dark ink and the
 * hue on the icon; `aria-current="page"` tells screen readers, so colour is never the only cue.
 */
@Component({
  selector: 'nn-tab-bar',
  imports: [RouterLink, RouterLinkActive, NnIcon],
  template: `
    <nav
      class="grid gap-1 border-t border-border bg-surface px-2 pt-1.5 pb-[calc(6px+env(safe-area-inset-bottom))]"
      [style.grid-template-columns]="
        'repeat(' + (items().length + (moreLabel() ? 1 : 0)) + ', minmax(0, 1fr))'
      "
      [attr.aria-label]="label()"
    >
      @for (item of items(); track item.link) {
        <a
          [routerLink]="item.link"
          routerLinkActive="!bg-accent-soft !text-accent-ink font-semibold [&_nn-icon]:text-accent"
          [routerLinkActiveOptions]="{ exact: !!item.exact }"
          ariaCurrentWhenActive="page"
          class="flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-[10px] text-xs text-muted"
        >
          <nn-icon [name]="item.icon" />
          {{ item.label }}
          @if (item.badge) {
            <span class="sr-only">({{ item.badge }})</span>
          }
        </a>
      }
      @if (moreLabel()) {
        <button
          type="button"
          class="flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-[10px] text-xs text-muted"
          aria-haspopup="dialog"
          (click)="more.emit()"
        >
          <span class="relative">
            <nn-icon name="more" />
            @if (moreBadge()) {
              <span
                class="absolute -top-1 -right-2.5 min-w-4 rounded-full bg-accent px-1 text-[10px] font-semibold leading-4 text-on-accent num"
                aria-hidden="true"
                >{{ moreBadge() }}</span
              >
            }
          </span>
          {{ moreLabel() }}
          @if (moreBadge()) {
            <span class="sr-only">({{ moreBadge() }})</span>
          }
        </button>
      }
    </nav>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NnTabBar {
  readonly items = input.required<NavItem[]>();
  readonly label = input('Main');
  readonly moreLabel = input<string | null>(null);
  /** Sum of the badges hidden behind "More". */
  readonly moreBadge = input(0);
  readonly more = output<void>();
}
