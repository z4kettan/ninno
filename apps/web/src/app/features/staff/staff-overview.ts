import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NnEmptyState } from '@ninno/ui';

/**
 * Staff overview. Occupancy and "needs attention" arrive with onboarding and billing.
 * The hostel's name is in the shell (sidebar / phone header), so the page doesn't repeat it.
 */
@Component({
  selector: 'nn-staff-overview',
  imports: [NnEmptyState],
  template: `
    <h1 class="text-2xl font-bold leading-tight" i18n>Overview</h1>
    <div class="mt-6 grid gap-4 lg:grid-cols-2">
      <nn-empty-state
        heading="Beds filled"
        i18n-heading
        message="Occupancy appears here once residents join and you assign their beds."
        i18n-message
      />
      <nn-empty-state
        heading="Needs attention"
        i18n-heading
        message="New sign-ups to approve and rent that is due or late appear here."
        i18n-message
      />
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StaffOverview {}
