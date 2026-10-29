import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NnEmptyState } from '@ninno/ui';
import { AuthStore } from '../../core/auth/auth.store';

/** The resident's home. Rent, room and the rent cycle strip arrive with billing (Phase 3). */
@Component({
  selector: 'nn-resident-home',
  imports: [NnEmptyState],
  template: `
    <h1 class="text-2xl font-bold leading-tight">{{ hostel() }}</h1>
    <p class="mt-1 text-muted" i18n>Hello, {{ firstName() }}</p>
    <nn-empty-state
      class="mt-6"
      heading="Your rent"
      i18n-heading
      message="Your rent amount and due date appear here once the hostel approves your stay and sets your rent."
      i18n-message
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResidentHome {
  private readonly store = inject(AuthStore);
  private readonly membership = computed(
    () => this.store.user()?.memberships.find((m) => m.role === 'RESIDENT') ?? null,
  );
  protected readonly hostel = computed(
    () => this.membership()?.hostelName ?? this.membership()?.organizationName ?? 'Ninno',
  );
  protected readonly firstName = computed(() => this.store.user()?.name.split(' ')[0] ?? '');
}
