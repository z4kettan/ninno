import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NnIcon } from '@ninno/ui';
import { AuthStore } from '../../core/auth/auth.store';
import type { NavItem } from '../shared/nav';

/** The staff destinations that don't fit in the phone's bottom tabs, plus profile and sign out. */
@Component({
  selector: 'nn-staff-more-sheet',
  imports: [RouterLink, NnIcon],
  template: `
    <div class="mx-auto mb-3 h-1 w-10 rounded-full bg-border" aria-hidden="true"></div>
    <h2 class="sr-only" i18n>More</h2>
    <ul>
      @for (item of items; track item.link) {
        <li>
          <a
            [routerLink]="item.link"
            (click)="ref.close()"
            class="flex min-h-12 items-center gap-3 rounded-control px-2 hover:bg-raised"
          >
            <nn-icon [name]="item.icon" class="text-muted" />
            {{ item.label }}
          </a>
        </li>
      }
      <li>
        <a
          routerLink="/admin/profile"
          (click)="ref.close()"
          class="flex min-h-12 items-center gap-3 rounded-control px-2 hover:bg-raised"
        >
          <nn-icon name="profile" class="text-muted" />
          <span i18n>Profile</span>
        </a>
      </li>
      <li class="mt-2 border-t border-border pt-2">
        <button
          type="button"
          class="flex min-h-12 w-full items-center gap-3 rounded-control px-2 text-left hover:bg-raised"
          (click)="signOut()"
        >
          <nn-icon name="signOut" class="text-muted" />
          <span i18n>Sign out</span>
        </button>
      </li>
    </ul>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StaffMoreSheet {
  protected readonly items = inject<NavItem[]>(DIALOG_DATA);
  protected readonly ref = inject(DialogRef);
  private readonly store = inject(AuthStore);
  private readonly router = inject(Router);

  protected async signOut(): Promise<void> {
    this.ref.close();
    await this.store.logout().catch(() => undefined);
    await this.router.navigateByUrl('/login');
  }
}
