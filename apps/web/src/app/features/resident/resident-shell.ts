import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { type NavItem, NnTabBar } from '../shared/nav';

/** Residents: one column, bottom tabs at every width (the resident app is a phone app). */
@Component({
  selector: 'nn-resident-shell',
  imports: [RouterOutlet, NnTabBar],
  template: `
    <div class="mx-auto min-h-dvh max-w-md px-4 pt-6 pb-28">
      <router-outlet />
    </div>
    <nn-tab-bar
      class="fixed inset-x-0 bottom-0 z-10 mx-auto block max-w-md"
      [items]="tabs"
      label="Resident"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResidentShell {
  protected readonly tabs: NavItem[] = [
    { label: $localize`Home`, icon: 'home', link: '/home', exact: true },
    { label: $localize`Payments`, icon: 'payments', link: '/home/payments' },
    { label: $localize`Profile`, icon: 'profile', link: '/home/profile' },
  ];
}
