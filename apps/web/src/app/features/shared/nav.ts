import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { type IconName, NnIcon } from '@ninno/ui';

export interface NavItem {
  label: string;
  icon: IconName;
  link: string;
  /** Match the link exactly (for area roots like "/admin"). */
  exact?: boolean;
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
        </a>
      }
      @if (moreLabel()) {
        <button
          type="button"
          class="flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-[10px] text-xs text-muted"
          aria-haspopup="dialog"
          (click)="more.emit()"
        >
          <nn-icon name="more" />
          {{ moreLabel() }}
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
  readonly more = output<void>();
}
