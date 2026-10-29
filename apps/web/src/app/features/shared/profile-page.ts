import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import type { Role } from '@ninno/contracts';
import { NnButton, NnCard } from '@ninno/ui';
import { AuthStore } from '../../core/auth/auth.store';

const ROLE_LABEL: Record<Role, string> = {
  OWNER: $localize`Owner`,
  MANAGER: $localize`Manager`,
  STAFF: $localize`Staff`,
  RESIDENT: $localize`Resident`,
};

@Component({
  selector: 'nn-profile-page',
  imports: [NnButton, NnCard],
  template: `
    <h1 class="text-2xl font-bold leading-tight" i18n>Profile</h1>
    @if (store.user(); as user) {
      <nn-card class="mt-6">
        <p class="text-lg font-semibold">{{ user.name }}</p>
        <p class="mt-1 text-muted num">{{ user.phoneMasked }}</p>
      </nn-card>

      <h2 class="mt-8 text-lg font-semibold" i18n>Your hostels</h2>
      <nn-card class="mt-3 !p-0">
        <ul>
          @for (m of user.memberships; track m.organizationId + (m.hostelId ?? '')) {
            <li
              class="flex min-h-12 items-center justify-between gap-3 border-b border-rule px-4 py-3 last:border-0"
            >
              <span>{{ m.hostelName ?? m.organizationName }}</span>
              <span class="rounded-full bg-raised px-2 py-0.5 text-xs font-medium text-muted">{{
                roleLabel[m.role]
              }}</span>
            </li>
          }
        </ul>
      </nn-card>
    }
    <button nnButton variant="secondary" type="button" class="mt-8" (click)="signOut()" i18n>
      Sign out
    </button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfilePage {
  protected readonly store = inject(AuthStore);
  private readonly router = inject(Router);
  protected readonly roleLabel = ROLE_LABEL;

  protected async signOut(): Promise<void> {
    await this.store.logout().catch(() => undefined);
    await this.router.navigateByUrl('/login');
  }
}
