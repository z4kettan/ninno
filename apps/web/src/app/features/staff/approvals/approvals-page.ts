import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { ApprovalListResponse, OccupationType } from '@ninno/contracts';
import { NnButton, NnEmptyState, NnSkeleton } from '@ninno/ui';
import { API } from '../../../core/auth/auth.store';
import { settledValue } from '../../../core/http/settled-value';
import { timeAgo } from './approval-form';
import { ApprovalsBadge } from './approvals-badge';

const OCCUPATION: Record<OccupationType, string> = {
  STUDENT: $localize`Student`,
  WORKING: $localize`Working`,
  OTHER: $localize`Other`,
};

/** New sign-ups waiting for a decision, oldest first. */
@Component({
  selector: 'nn-approvals-page',
  imports: [RouterLink, NnButton, NnEmptyState, NnSkeleton],
  template: `
    <h1 class="text-2xl font-bold leading-tight" i18n>Approvals</h1>
    <p class="mt-1 text-muted" i18n>Check each new resident's details and ID, then assign a bed.</p>

    @if (list.isLoading() && !list.hasValue()) {
      <nn-skeleton class="mt-6 block h-16 w-full" />
      <nn-skeleton class="mt-2 block h-16 w-full" />
    } @else if (list.error()) {
      <nn-empty-state
        class="mt-6"
        heading="Couldn't load applications"
        i18n-heading
        message="Check your connection and try again."
        i18n-message
      >
        <button nnButton variant="secondary" (click)="list.reload()" i18n>Try again</button>
      </nn-empty-state>
    } @else if (items().length === 0) {
      <nn-empty-state
        class="mt-6"
        heading="Nothing to review"
        i18n-heading
        message="New residents appear here after they scan your QR code and submit their details."
        i18n-message
      >
        <a nnButton variant="secondary" routerLink="/admin/onboarding" i18n>Show the QR code</a>
      </nn-empty-state>
    } @else {
      <ul
        class="mt-6 divide-y divide-rule overflow-hidden rounded-card border border-border bg-surface"
      >
        @for (item of items(); track item.residentId) {
          <li>
            <a
              [routerLink]="item.residentId"
              class="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-raised"
            >
              <span class="min-w-0 flex-1">
                <span class="block truncate font-semibold">{{ item.fullName }}</span>
                <span class="block truncate text-sm text-muted">
                  {{ occupation(item.occupationType) }}
                  @if (item.institutionOrCompany) {
                    · {{ item.institutionOrCompany }}
                  }
                  @if (multipleHostels()) {
                    · {{ item.hostelName }}
                  }
                </span>
              </span>
              <span class="shrink-0 text-sm text-muted">{{ ago(item.submittedAt) }}</span>
            </a>
          </li>
        }
      </ul>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApprovalsPage {
  protected readonly list = httpResource<ApprovalListResponse>(() => `${API}/approvals`);
  private readonly loaded = settledValue(this.list);
  protected readonly items = computed(() => this.loaded()?.items ?? []);
  protected readonly multipleHostels = computed(
    () => new Set(this.items().map((i) => i.hostelId)).size > 1,
  );

  constructor() {
    inject(ApprovalsBadge).refresh();
  }

  protected occupation(type: OccupationType): string {
    return OCCUPATION[type];
  }

  protected ago(iso: string): string {
    return timeAgo(iso);
  }
}
