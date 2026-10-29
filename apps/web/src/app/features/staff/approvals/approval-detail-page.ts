import { HttpClient, HttpErrorResponse, httpResource } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  type ApiErrorBody,
  type ApprovalDetailResponse,
  ErrorCode,
  type FileViewResponse,
  type ResidentFile,
} from '@ninno/contracts';
import {
  IstDatePipe,
  NnButton,
  NnCard,
  NnField,
  NnIcon,
  NnInput,
  NnPill,
  NnSkeleton,
  SheetService,
  ToastService,
} from '@ninno/ui';
import { formatIndianPhone, formatInr, todayIst } from '@ninno/utils';
import { firstValueFrom } from 'rxjs';
import { API, AuthStore } from '../../../core/auth/auth.store';
import { settledValue } from '../../../core/http/settled-value';
import { ID_TYPE_LABELS } from '../../join/steps/step-id';
import {
  type ApprovalFormErrors,
  type ApprovalFormValue,
  approvalDefaults,
  groupBedsByRoom,
  toApproveRequest,
} from './approval-form';
import { FileSheet, type FileSheetData, RejectSheet } from './approval-sheets';
import { ApprovalsBadge } from './approvals-badge';

const GENDER: Record<string, string> = {
  FEMALE: $localize`Female`,
  MALE: $localize`Male`,
  OTHER: $localize`Other`,
};
const OCCUPATION: Record<string, string> = {
  STUDENT: $localize`Student`,
  WORKING: $localize`Working`,
  OTHER: $localize`Other`,
};

/** One application: who they are, their ID, and the decision. */
@Component({
  selector: 'nn-approval-detail-page',
  imports: [
    RouterLink,
    IstDatePipe,
    NnButton,
    NnCard,
    NnField,
    NnIcon,
    NnInput,
    NnPill,
    NnSkeleton,
  ],
  template: `
    <a
      routerLink="/admin/approvals"
      class="inline-flex min-h-11 items-center gap-1 text-sm text-muted hover:text-text"
    >
      <nn-icon name="chevronLeft" [size]="18" />
      <span i18n>Approvals</span>
    </a>

    @if (current(); as d) {
      <div class="mt-2 flex flex-wrap items-center gap-3">
        <h1 class="text-2xl font-bold leading-tight">{{ d.fullName }}</h1>
        @if (d.status !== 'PENDING_REVIEW') {
          <nn-pill [tone]="d.status === 'ACTIVE' ? 'positive' : 'negative'">{{
            statusLabel(d.status)
          }}</nn-pill>
        }
      </div>
      <p class="mt-1 text-muted">
        <span i18n>Applied</span> {{ d.submittedAt | istDate }} · {{ d.hostelName }}
      </p>

      <div class="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:items-start">
        <div class="flex flex-col gap-6">
          <nn-card>
            <div class="flex gap-4">
              @if (selfieView(); as s) {
                <img
                  [src]="s.url"
                  alt="Selfie"
                  i18n-alt
                  class="size-24 shrink-0 rounded-control bg-raised object-cover"
                />
              } @else {
                <div class="size-24 shrink-0 animate-pulse rounded-control bg-raised"></div>
              }
              <dl class="grid min-w-0 flex-1 content-start gap-1">
                <dt class="sr-only" i18n>Mobile</dt>
                <dd class="m-0">
                  <a
                    class="font-semibold text-accent-ink underline-offset-2 hover:underline num"
                    [href]="'tel:' + d.phone"
                    >{{ phone(d.phone) }}</a
                  >
                </dd>
                <dt class="sr-only" i18n>Born</dt>
                <dd class="m-0 text-muted">{{ d.dob | istDate }} · {{ gender(d.gender) }}</dd>
                @if (d.email) {
                  <dt class="sr-only" i18n>Email</dt>
                  <dd class="m-0 truncate text-muted">{{ d.email }}</dd>
                }
              </dl>
            </div>
          </nn-card>

          <section>
            <h2 class="text-lg font-semibold" i18n>Details</h2>
            <dl class="mt-2 grid gap-3 rounded-card border border-border bg-surface p-4">
              <div>
                <dt class="text-sm text-muted" i18n>Permanent address</dt>
                <dd class="m-0">{{ address(d) }}</dd>
              </div>
              <div>
                <dt class="text-sm text-muted" i18n>Work or study</dt>
                <dd class="m-0">
                  {{ work(d) }}
                </dd>
              </div>
              @if (d.altPhone) {
                <div>
                  <dt class="text-sm text-muted" i18n>Other number</dt>
                  <dd class="m-0 num">{{ phone(d.altPhone) }}</dd>
                </div>
              }
              <div>
                <dt class="text-sm text-muted" i18n>Emergency contact</dt>
                <dd class="m-0">
                  {{ d.emergencyContact.name }} ({{ d.emergencyContact.relation }}) ·
                  <a class="text-accent-ink num" [href]="'tel:' + d.emergencyContact.phone">{{
                    phone(d.emergencyContact.phone)
                  }}</a>
                </dd>
              </div>
              <div>
                <dt class="text-sm text-muted" i18n>Consent</dt>
                <dd class="m-0">
                  <span i18n>Accepted version</span> {{ d.consentVersion }},
                  {{ d.consentAcceptedAt | istDate }}
                </dd>
              </div>
            </dl>
          </section>

          <section>
            <h2 class="text-lg font-semibold" i18n>ID</h2>
            <div class="mt-2 rounded-card border border-border bg-surface p-4">
              <p>
                {{ idType(d.idDocument.type) }} ·
                <span class="num">{{ d.idDocument.numberMasked }}</span>
              </p>
              <div class="mt-3 flex flex-wrap gap-2">
                <button
                  nnButton
                  variant="secondary"
                  type="button"
                  (click)="openFile('id-front')"
                  i18n
                >
                  View front
                </button>
                @if (d.idDocument.hasBack) {
                  <button
                    nnButton
                    variant="secondary"
                    type="button"
                    (click)="openFile('id-back')"
                    i18n
                  >
                    View back
                  </button>
                }
              </div>
            </div>
          </section>
        </div>

        @if (d.status === 'PENDING_REVIEW') {
          <section
            class="rounded-card border border-border bg-surface p-4"
            aria-labelledby="decide"
          >
            <h2 id="decide" class="text-lg font-semibold" i18n>Approve and assign a bed</h2>
            @if (!canDecide()) {
              <p class="mt-2 text-muted" i18n>An owner or manager approves applications.</p>
            } @else if (d.vacantBeds.length === 0) {
              <p class="mt-2 text-muted" i18n>
                There are no vacant beds. Free a bed first, or not approve.
              </p>
            } @else {
              <form
                class="mt-4 flex flex-col gap-4"
                (submit)="$event.preventDefault(); approve(d)"
                novalidate
              >
                <nn-field fieldId="ap-bed" label="Bed" i18n-label [error]="errors().bedId ?? null">
                  <select
                    nnInput
                    id="ap-bed"
                    [value]="form().bedId"
                    (change)="chooseBed(d, $any($event.target).value)"
                    aria-describedby="ap-bed-msg"
                    [attr.aria-invalid]="!!errors().bedId"
                  >
                    <option value="" i18n>Choose a bed</option>
                    @for (room of rooms(); track room.label) {
                      <optgroup [label]="room.label">
                        @for (bed of room.beds; track bed.id) {
                          <option [value]="bed.id">{{ bed.label }}</option>
                        }
                      </optgroup>
                    }
                  </select>
                </nn-field>
                <nn-field
                  fieldId="ap-date"
                  label="Check-in date"
                  i18n-label
                  [error]="errors().checkInDate ?? null"
                >
                  <input
                    nnInput
                    id="ap-date"
                    type="date"
                    [value]="form().checkInDate"
                    (input)="patch({ checkInDate: $any($event.target).value })"
                    aria-describedby="ap-date-msg"
                  />
                </nn-field>
                <div class="grid grid-cols-2 gap-3">
                  <nn-field
                    fieldId="ap-rent"
                    label="Monthly rent (₹)"
                    i18n-label
                    [error]="errors().rentRupees ?? null"
                  >
                    <input
                      nnInput
                      id="ap-rent"
                      inputmode="decimal"
                      [value]="form().rentRupees"
                      (input)="patch({ rentRupees: $any($event.target).value })"
                      aria-describedby="ap-rent-msg"
                      [attr.aria-invalid]="!!errors().rentRupees"
                    />
                  </nn-field>
                  <nn-field
                    fieldId="ap-dep"
                    label="Deposit (₹)"
                    i18n-label
                    [error]="errors().depositRupees ?? null"
                  >
                    <input
                      nnInput
                      id="ap-dep"
                      inputmode="decimal"
                      [value]="form().depositRupees"
                      (input)="patch({ depositRupees: $any($event.target).value })"
                      aria-describedby="ap-dep-msg"
                      [attr.aria-invalid]="!!errors().depositRupees"
                    />
                  </nn-field>
                </div>
                @if (d.billingMode === 'FIXED_DAY' && d.fixedDueDay) {
                  <p class="text-sm text-muted" i18n>
                    Rent is due on day {{ d.fixedDueDay }} of each month.
                  </p>
                } @else if (form().checkInDate) {
                  <p class="text-sm text-muted" i18n>
                    Rent is due on day {{ anchorDay() }} of each month, from check-in.
                  </p>
                }
                @if (formError()) {
                  <p class="text-sm text-negative" role="alert">{{ formError() }}</p>
                }
                <button nnButton type="submit" [block]="true" [loading]="busy() === 'approve'" i18n>
                  Approve
                </button>
                <button
                  nnButton
                  variant="text"
                  type="button"
                  [loading]="busy() === 'reject'"
                  (click)="reject(d)"
                  i18n
                >
                  Not approve…
                </button>
              </form>
            }
          </section>
        }
      </div>
    } @else if (detail.error()) {
      <p class="mt-6" i18n>This application could not be found.</p>
    } @else {
      <nn-skeleton class="mt-4 block h-8 w-1/2" />
      <nn-skeleton class="mt-6 block h-40 w-full" />
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApprovalDetailPage {
  readonly id = input.required<string>();

  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly sheet = inject(SheetService);
  private readonly toast = inject(ToastService);
  private readonly badge = inject(ApprovalsBadge);
  private readonly auth = inject(AuthStore);

  protected readonly detail = httpResource<ApprovalDetailResponse>(
    () => `${API}/approvals/${this.id()}`,
  );
  /** Shown on every open; each fetch of this link is recorded as photo.viewed. */
  protected readonly selfie = httpResource<FileViewResponse>(() =>
    this.detail.hasValue() ? `${API}/residents/${this.id()}/files/selfie` : undefined,
  );
  protected readonly current = settledValue(this.detail);
  protected readonly selfieView = settledValue(this.selfie);

  protected readonly canDecide = computed(() =>
    ['OWNER', 'MANAGER'].includes(this.auth.staffMembership()?.role ?? ''),
  );
  protected readonly rooms = computed(() =>
    groupBedsByRoom(this.current()?.vacantBeds ?? [], (p) => formatInr(BigInt(p))),
  );
  protected readonly form = linkedSignal<ApprovalFormValue>(() => {
    const d = this.current();
    return d
      ? approvalDefaults(d, '', todayIst())
      : { bedId: '', checkInDate: '', rentRupees: '', depositRupees: '' };
  });
  protected readonly errors = signal<ApprovalFormErrors>({});
  protected readonly formError = signal<string | null>(null);
  protected readonly busy = signal<'approve' | 'reject' | null>(null);
  protected readonly anchorDay = computed(() => Number(this.form().checkInDate.slice(8, 10)));

  protected patch(change: Partial<ApprovalFormValue>): void {
    this.form.update((f) => ({ ...f, ...change }));
  }

  /** Picking a bed proposes that room's rent, keeping the date and deposit. */
  protected chooseBed(d: ApprovalDetailResponse, bedId: string): void {
    const defaults = approvalDefaults(d, bedId, this.form().checkInDate);
    this.patch({ bedId, rentRupees: defaults.rentRupees });
  }

  protected openFile(file: ResidentFile): void {
    const title = file === 'id-front' ? $localize`ID front` : $localize`ID back`;
    this.sheet.open<void, FileSheetData>(FileSheet, {
      label: title,
      data: { residentId: this.id(), file, title },
    });
  }

  protected async approve(d: ApprovalDetailResponse): Promise<void> {
    const { request, errors } = toApproveRequest(this.form());
    this.errors.set(errors ?? {});
    this.formError.set(null);
    if (!request) {
      return;
    }
    this.busy.set('approve');
    try {
      await firstValueFrom(this.http.post(`${API}/approvals/${d.residentId}/approve`, request));
      this.badge.refresh();
      this.toast.show($localize`${d.fullName}:name: is now a resident.`, 'success');
      await this.router.navigateByUrl('/admin/approvals');
    } catch (error) {
      this.formError.set(this.decisionError(error));
      this.detail.reload();
    } finally {
      this.busy.set(null);
    }
  }

  protected async reject(d: ApprovalDetailResponse): Promise<void> {
    const ref = this.sheet.open<string>(RejectSheet, { label: $localize`Not approve` });
    const reason = await firstValueFrom(ref.closed);
    if (!reason) {
      return;
    }
    this.busy.set('reject');
    try {
      await firstValueFrom(this.http.post(`${API}/approvals/${d.residentId}/reject`, { reason }));
      this.badge.refresh();
      this.toast.show(
        $localize`Application not approved. ${d.fullName}:name: will see your reason.`,
      );
      await this.router.navigateByUrl('/admin/approvals');
    } catch (error) {
      this.formError.set(this.decisionError(error));
      this.detail.reload();
    } finally {
      this.busy.set(null);
    }
  }

  private decisionError(error: unknown): string {
    const code =
      error instanceof HttpErrorResponse ? (error.error as Partial<ApiErrorBody>)?.code : null;
    switch (code) {
      case ErrorCode.BedUnavailable:
        return $localize`That bed was just taken. Choose another.`;
      case ErrorCode.NotPending:
        return $localize`Someone has already decided this application.`;
      case ErrorCode.Forbidden:
        return $localize`Only an owner or manager can do this.`;
      default:
        return $localize`Something went wrong. Please try again.`;
    }
  }

  protected statusLabel(status: string): string {
    return status === 'ACTIVE' ? $localize`Approved` : $localize`Not approved`;
  }

  protected gender(value: string): string {
    return GENDER[value] ?? value;
  }

  protected work(d: ApprovalDetailResponse): string {
    const type = OCCUPATION[d.occupationType] ?? d.occupationType;
    return d.institutionOrCompany ? `${type}, ${d.institutionOrCompany}` : type;
  }

  protected phone(value: string): string {
    return formatIndianPhone(value);
  }

  protected idType(value: keyof typeof ID_TYPE_LABELS): string {
    return ID_TYPE_LABELS[value];
  }

  protected address(d: ApprovalDetailResponse): string {
    const a = d.permanentAddress;
    return [a.line1, a.line2, a.city, a.state, a.pincode].filter(Boolean).join(', ');
  }
}
