import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NnIcon, NnMark, SheetService } from '@ninno/ui';
import { AuthStore } from '../../core/auth/auth.store';
import { type NavItem, NnTabBar } from '../shared/nav';
import { ApprovalsBadge } from './approvals/approvals-badge';
import { StaffMoreSheet } from './staff-more-sheet';

const ALL: NavItem[] = [
  { label: $localize`Overview`, icon: 'home', link: '/admin', exact: true },
  { label: $localize`Residents`, icon: 'residents', link: '/admin/residents' },
  { label: $localize`Approvals`, icon: 'approvals', link: '/admin/approvals' },
  { label: $localize`Beds`, icon: 'beds', link: '/admin/beds' },
  { label: $localize`Payments`, icon: 'payments', link: '/admin/payments' },
  { label: $localize`Onboarding QR`, icon: 'qr', link: '/admin/onboarding' },
  { label: $localize`Settings`, icon: 'settings', link: '/admin/settings' },
];
const TAB_LINKS = ['/admin', '/admin/residents', '/admin/beds'];

/**
 * Staff: a labelled sidebar from 1024px (open plane: on the page ground, one hairline), and
 * bottom tabs below it with the rest of the destinations behind "More".
 */
@Component({
  selector: 'nn-staff-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NnIcon, NnMark, NnTabBar],
  // One badge for the shell and every staff page under it (approvals refresh it).
  providers: [ApprovalsBadge],
  template: `
    <div class="min-h-dvh lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside
        class="sticky top-0 hidden h-dvh flex-col border-r border-border px-3 py-5 lg:flex"
        aria-label="Hostel"
        i18n-aria-label
      >
        <div class="px-2">
          <nn-mark [wordmark]="true" />
          <p class="mt-3 truncate text-sm font-medium" [title]="scope()">{{ scope() }}</p>
        </div>
        <nav class="mt-6 flex flex-col gap-0.5" aria-label="Staff" i18n-aria-label>
          @for (item of all(); track item.link) {
            <a
              [routerLink]="item.link"
              routerLinkActive="!bg-accent-soft !text-accent-ink font-semibold [&_nn-icon]:text-accent"
              [routerLinkActiveOptions]="{ exact: !!item.exact }"
              ariaCurrentWhenActive="page"
              class="flex h-10 items-center gap-2.5 rounded-control px-2.5 text-sm text-muted hover:bg-raised"
            >
              <nn-icon [name]="item.icon" [size]="18" />
              <span class="flex-1">{{ item.label }}</span>
              @if (item.badge) {
                <span
                  class="min-w-6 rounded-full bg-accent-soft px-1.5 text-center text-xs font-semibold leading-5 text-accent-ink num"
                  >{{ item.badge }}<span class="sr-only" i18n> waiting</span></span
                >
              }
            </a>
          }
        </nav>
        <div class="mt-auto border-t border-border px-2 pt-4">
          <a
            routerLink="/admin/profile"
            class="block truncate text-sm font-medium hover:underline"
            >{{ store.user()?.name }}</a
          >
          <button
            type="button"
            class="mt-1 flex min-h-11 items-center gap-2 text-sm text-muted hover:text-text"
            (click)="signOut()"
          >
            <nn-icon name="signOut" [size]="18" />
            <span i18n>Sign out</span>
          </button>
        </div>
      </aside>

      <div class="mx-auto w-full max-w-6xl px-4 pt-6 pb-28 lg:px-8 lg:pt-9 lg:pb-12">
        <p class="mb-4 flex items-center gap-2 text-sm font-medium lg:hidden">
          <nn-mark [size]="22" />
          <span class="truncate">{{ scope() }}</span>
        </p>
        <router-outlet />
      </div>
    </div>

    <nn-tab-bar
      class="fixed inset-x-0 bottom-0 z-10 block lg:hidden"
      [items]="tabs()"
      label="Staff"
      moreLabel="More"
      i18n-moreLabel
      [moreBadge]="badge.count()"
      (more)="openMore()"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StaffShell {
  protected readonly store = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly sheet = inject(SheetService);

  protected readonly badge = inject(ApprovalsBadge);

  protected readonly all = computed<NavItem[]>(() =>
    ALL.map((item) =>
      item.link === '/admin/approvals' ? { ...item, badge: this.badge.count() } : item,
    ),
  );
  protected readonly tabs = computed(() => this.all().filter((i) => TAB_LINKS.includes(i.link)));
  protected readonly scope = computed(() => {
    const m = this.store.staffMembership();
    return m?.hostelName ?? m?.organizationName ?? '';
  });

  protected openMore(): void {
    this.sheet.open(StaffMoreSheet, {
      label: $localize`More`,
      data: this.all().filter((i) => !TAB_LINKS.includes(i.link)),
    });
  }

  protected async signOut(): Promise<void> {
    await this.store.logout().catch(() => undefined);
    await this.router.navigateByUrl('/login');
  }
}
