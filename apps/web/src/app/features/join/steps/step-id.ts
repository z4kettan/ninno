import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { type Choice, NnChoiceCards, NnField, NnInput, NnPhotoTile } from '@ninno/ui';
import { idTypeNeedsBack, type IdDocumentType } from '@ninno/utils';
import { JoinDraftStore } from '../join-draft.store';
import { JoinUploader } from '../join-uploader';
import { fieldError } from './field-error';

export const ID_TYPE_LABELS: Record<IdDocumentType, string> = {
  AADHAAR: $localize`Aadhaar`,
  VOTER_ID: $localize`Voter ID`,
  PASSPORT: $localize`Passport`,
  DRIVING_LICENCE: $localize`Driving licence`,
  PAN: $localize`PAN card`,
  OTHER: $localize`Other ID`,
};

@Component({
  selector: 'nn-step-id',
  imports: [ReactiveFormsModule, NnChoiceCards, NnField, NnInput, NnPhotoTile],
  template: `
    <div class="flex flex-col gap-5" [formGroup]="form">
      <nn-choice-cards
        legend="Which ID will you use?"
        i18n-legend
        [options]="types"
        [columns]="2"
        [value]="type() || null"
        (valueChange)="
          form.controls.type.setValue($any($event)); form.controls.type.markAsTouched()
        "
        [error]="typeError()"
      />
      @if (type()) {
        <nn-field
          fieldId="j-idno"
          [label]="numberLabel()"
          [hint]="numberHint()"
          [error]="numberError()"
        >
          <input
            nnInput
            id="j-idno"
            formControlName="idNumber"
            autocomplete="off"
            autocapitalize="characters"
            spellcheck="false"
            [attr.inputmode]="type() === 'AADHAAR' ? 'numeric' : null"
            aria-describedby="j-idno-msg"
            [attr.aria-invalid]="!!numberError()"
          />
        </nn-field>
        <div>
          <p class="mb-2 text-sm font-medium" i18n>Front of the ID</p>
          <nn-photo-tile
            label="Photo of the front"
            i18n-label
            hint="Lay it flat, with all four corners in the picture. A PDF works too."
            i18n-hint
            capture="environment"
            accept="image/*,application/pdf"
            [state]="uploads()['id-front'].state"
            [status]="uploads()['id-front'].status"
            [previewUrl]="uploads()['id-front'].previewUrl"
            [fileName]="uploads()['id-front'].fileName"
            [error]="uploads()['id-front'].error"
            (picked)="uploader.upload('id-front', $event)"
          />
        </div>
        @if (needsBack()) {
          <div>
            <p class="mb-2 text-sm font-medium" i18n>Back of the ID</p>
            <nn-photo-tile
              label="Photo of the back"
              i18n-label
              hint="The side with your address or the issue details."
              i18n-hint
              capture="environment"
              accept="image/*,application/pdf"
              [state]="uploads()['id-back'].state"
              [status]="uploads()['id-back'].status"
              [previewUrl]="uploads()['id-back'].previewUrl"
              [fileName]="uploads()['id-back'].fileName"
              [error]="uploads()['id-back'].error"
              (picked)="uploader.upload('id-back', $event)"
            />
          </div>
        }
        <p class="text-sm text-muted" i18n>
          Only the hostel's staff can see your ID. We keep just the last 4 characters of its number,
          and mark the photos "For the hostel's KYC only".
        </p>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StepId {
  protected readonly form = inject(JoinDraftStore).id;
  protected readonly uploader = inject(JoinUploader);
  protected readonly uploads = this.uploader.views;
  protected readonly type = toSignal(this.form.controls.type.valueChanges, {
    initialValue: this.form.controls.type.value,
  });
  protected readonly needsBack = computed(() => {
    const type = this.type();
    return type !== '' && idTypeNeedsBack(type);
  });
  protected readonly types: Choice[] = (Object.keys(ID_TYPE_LABELS) as IdDocumentType[]).map(
    (value) => ({ value, label: ID_TYPE_LABELS[value] }),
  );
  protected readonly numberLabel = computed(() => {
    const type = this.type();
    return type ? $localize`${ID_TYPE_LABELS[type]}:idType: number` : '';
  });
  protected readonly numberHint = computed(() =>
    this.type() === 'AADHAAR' ? $localize`12 digits, e.g. 2341 2341 2346` : null,
  );

  protected typeError(): string | null {
    return fieldError(this.form.controls.type);
  }

  protected numberError(): string | null {
    return fieldError(this.form.controls.idNumber, 'idNumber');
  }
}
