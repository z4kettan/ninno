import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import type { MyApplicationsResponse } from '@ninno/contracts';
import { NnButton, NnCard, NnEmptyState, NnPill, NnSkeleton } from '@ninno/ui';
import { formatIstDate, toIstDate } from '@ninno/utils';
import { API, AuthStore } from '../../core/auth/auth.store';
import { settledValue } from '../../core/http/settled-value';

/** The resident's home: where their application stands, then room and bed once active. */
@Component({
  selector: 'nn-resident-home',
  imports: [NnButton, NnCard, NnEmptyState, NnPill, NnSkeleton],
  template: `
    <h1 class="text-2xl font-bold leading-tight">{{ hostel() }}</h1>
    <p class="mt-1 text-muted" i18n>Hello, {{ firstName() }}</p>

    @if (applications.isLoading() && !applications.hasValue()) {
      <nn-skeleton class="mt-6 h-32 w-full" />
    } @else if (applications.error()) {
      <nn-card class="mt-6">
        <p i18n>We couldn't load your details just now.</p>
        <button nnButton variant="secondary" class="mt-4" (click)="applications.reload()" i18n>
          Try again
        </button>
      </nn-card>
    } @else if (latest(); as app) {
      <nn-card class="mt-6">
        @switch (app.status) {
          @case ('PENDING_REVIEW') {
            <nn-pill tone="warning" i18n>Waiting for approval</nn-pill>
            <p class="mt-3 text-lg font-semibold" i18n>
              Your details are with {{ app.hostelName }}
            </p>
            <p class="mt-1 text-muted" i18n>
              Submitted on {{ submitted() }}. The hostel will check your ID and assign your bed.
              This page updates when they do.
            </p>
          }
          @case ('REJECTED') {
            <nn-pill tone="negative" i18n>Not approved</nn-pill>
            <p class="mt-3 text-lg font-semibold" i18n>
              {{ app.hostelName }} could not approve your application
            </p>
            @if (app.rejectionReason) {
              <blockquote class="mt-3 border-l-2 border-border pl-3">
                <p class="text-sm text-muted" i18n>Their reason</p>
                <p class="mt-1">“{{ app.rejectionReason }}”</p>
              </blockquote>
            }
            <p class="mt-4" i18n>
              To apply again, scan the hostel's QR code and fill in the form with the changes they
              asked for.
            </p>
          }
          @case ('ACTIVE') {
            <nn-pill tone="positive" i18n>Active</nn-pill>
            <dl class="mt-4 grid grid-cols-2 gap-4">
              <div>
                <dt class="text-sm text-muted" i18n>Room</dt>
                <dd class="m-0 text-3xl font-semibold num">{{ app.roomNumber }}</dd>
              </div>
              <div>
                <dt class="text-sm text-muted" i18n>Bed</dt>
                <dd class="m-0 text-3xl font-semibold num">{{ app.bedLabel }}</dd>
              </div>
            </dl>
            @if (checkIn()) {
              <p class="mt-3 text-muted" i18n>Checked in on {{ checkIn() }}</p>
            }
          }
          @default {
            <nn-pill i18n>Moved out</nn-pill>
          }
        }
      </nn-card>
      @if (app.status === 'ACTIVE') {
        <nn-empty-state
          class="mt-6"
          heading="Your rent"
          i18n-heading
          message="Your rent amount and due date appear here once the hostel starts billing on Ninno."
          i18n-message
        />
      }
    } @else {
      <nn-empty-state
        class="mt-6"
        heading="No application yet"
        i18n-heading
        message="Scan your hostel's QR code to join."
        i18n-message
      />
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResidentHome {
  private readonly store = inject(AuthStore);
  protected readonly applications = httpResource<MyApplicationsResponse>(
    () => `${API}/residents/me`,
  );

  private readonly loaded = settledValue(this.applications);
  protected readonly latest = computed(() => this.loaded()?.applications[0] ?? null);
  private readonly membership = computed(
    () => this.store.user()?.memberships.find((m) => m.role === 'RESIDENT') ?? null,
  );
  protected readonly hostel = computed(
    () =>
      this.latest()?.hostelName ??
      this.membership()?.hostelName ??
      this.membership()?.organizationName ??
      'Ninno',
  );
  protected readonly firstName = computed(() => this.store.user()?.name.split(' ')[0] ?? '');
  protected readonly submitted = computed(() => {
    const app = this.latest();
    return app ? formatIstDate(toIstDate(app.submittedAt)) : '';
  });
  protected readonly checkIn = computed(() => {
    const date = this.latest()?.checkInDate;
    return date ? formatIstDate(date) : '';
  });
}
