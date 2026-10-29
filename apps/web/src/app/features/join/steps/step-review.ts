import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { CURRENT_CONSENT, renderConsent } from '@ninno/contracts';
import { formatIndianPhone, formatIstDate, isIsoDate, maskIdNumber } from '@ninno/utils';
import { JoinDraftStore } from '../join-draft.store';
import { JoinUploader } from '../join-uploader';
import { ID_TYPE_LABELS } from './step-id';

interface Row {
  label: string;
  value: string;
}

@Component({
  selector: 'nn-step-review',
  imports: [ReactiveFormsModule],
  template: `
    <div class="flex flex-col gap-6">
      @if (photos().length) {
        <div class="grid grid-cols-3 gap-2">
          @for (photo of photos(); track photo.label) {
            <figure class="m-0">
              @if (photo.url) {
                <img
                  [src]="photo.url"
                  [alt]="photo.label"
                  class="aspect-square w-full rounded-control border border-border bg-raised object-cover"
                />
              } @else {
                <div
                  class="grid aspect-square place-items-center rounded-control border border-border bg-raised px-2 text-center text-sm text-muted"
                >
                  {{ photo.name }}
                </div>
              }
              <figcaption class="mt-1 text-sm text-muted">{{ photo.label }}</figcaption>
            </figure>
          }
        </div>
      }

      @for (section of sections(); track section.step) {
        <section class="border-b border-rule pb-4">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold">{{ section.title }}</h2>
            <button
              type="button"
              class="min-h-11 rounded-control px-2 font-semibold text-accent-ink hover:bg-accent-soft"
              (click)="edit.emit(section.step)"
              i18n
            >
              Edit
            </button>
          </div>
          <dl class="mt-2 grid gap-2">
            @for (row of section.rows; track row.label) {
              <div class="grid grid-cols-[8rem_1fr] gap-3">
                <dt class="text-sm text-muted">{{ row.label }}</dt>
                <dd class="m-0 break-words">{{ row.value }}</dd>
              </div>
            }
          </dl>
        </section>
      }

      <section class="rounded-card bg-accent-soft p-4" aria-labelledby="consent-title">
        <h2 id="consent-title" class="text-lg font-semibold text-accent-ink">
          {{ consent().title }}
        </h2>
        @for (paragraph of consent().paragraphs; track $index) {
          <p class="mt-3">{{ paragraph }}</p>
        }
        <label class="mt-4 flex min-h-11 cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            class="mt-1 size-5 shrink-0 accent-[var(--accent)]"
            [formControl]="store.consent"
            aria-describedby="consent-error"
            [attr.aria-invalid]="consentMissing() || null"
          />
          <span class="font-medium">{{ consent().checkboxLabel }}</span>
        </label>
        @if (consentMissing()) {
          <p id="consent-error" class="mt-2 text-sm text-negative" i18n>
            Tick the box to agree before submitting.
          </p>
        }
      </section>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StepReview {
  readonly hostelName = input.required<string>();
  readonly edit = output<number>();

  protected readonly store = inject(JoinDraftStore);
  private readonly uploads = inject(JoinUploader).views;

  protected readonly consent = computed(() => renderConsent(CURRENT_CONSENT, this.hostelName()));

  protected consentMissing(): boolean {
    return this.store.consent.touched && !this.store.consent.value;
  }

  protected readonly photos = computed(() => {
    const views = this.uploads();
    const files = this.store.files();
    const list = [
      { kind: 'selfie' as const, label: $localize`Selfie` },
      { kind: 'id-front' as const, label: $localize`ID front` },
      { kind: 'id-back' as const, label: $localize`ID back` },
    ];
    return list
      .filter(({ kind }) => files[kind])
      .map(({ kind, label }) => ({
        label,
        url: views[kind].previewUrl,
        name: files[kind]?.name ?? '',
      }));
  });

  /** Recomputed each change detection: the forms are not signals. */
  protected sections() {
    const f = this.store.form();
    const rows = (pairs: [string, string | null | undefined][]): Row[] =>
      pairs.filter(([, v]) => !!v).map(([label, value]) => ({ label, value: value as string }));
    const address = f.permanentAddress;
    return [
      {
        step: 1,
        title: $localize`About you`,
        rows: rows([
          [$localize`Name`, f.fullName],
          [$localize`Date of birth`, isIsoDate(f.dob) ? formatIstDate(f.dob) : f.dob],
          [$localize`Gender`, GENDER_LABELS[f.gender] ?? f.gender],
        ]),
      },
      {
        step: 2,
        title: $localize`Contact`,
        rows: rows([
          [$localize`Mobile`, formatIndianPhone(f.phone)],
          [$localize`Other number`, f.altPhone ? formatIndianPhone(f.altPhone) : null],
          [$localize`Email`, f.email],
          [
            $localize`Address`,
            [address.line1, address.line2, address.city, address.state, address.pincode]
              .filter(Boolean)
              .join(', '),
          ],
        ]),
      },
      {
        step: 3,
        title: $localize`Work or study`,
        rows: rows([
          [$localize`Occupation`, OCCUPATION_LABELS[f.occupationType] ?? f.occupationType],
          [$localize`College or company`, f.institutionOrCompany],
        ]),
      },
      {
        step: 4,
        title: $localize`Emergency contact`,
        rows: rows([
          [$localize`Name`, f.emergencyContact.name],
          [$localize`Mobile`, formatIndianPhone(f.emergencyContact.phone)],
          [$localize`Relation`, f.emergencyContact.relation],
        ]),
      },
      {
        step: 5,
        title: $localize`ID`,
        rows: rows([
          [$localize`Type`, ID_TYPE_LABELS[f.idDocument.type]],
          [
            $localize`Number`,
            f.idDocument.idNumber ? maskIdNumber(f.idDocument.type, f.idDocument.idNumber) : '',
          ],
        ]),
      },
    ];
  }
}

const GENDER_LABELS: Record<string, string> = {
  FEMALE: $localize`Female`,
  MALE: $localize`Male`,
  OTHER: $localize`Other`,
};

const OCCUPATION_LABELS: Record<string, string> = {
  STUDENT: $localize`Student`,
  WORKING: $localize`Working`,
  OTHER: $localize`Something else`,
};
