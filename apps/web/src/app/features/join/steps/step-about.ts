import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { type Choice, NnChoiceCards, NnField, NnInput, NnPhotoTile } from '@ninno/ui';
import { todayIst } from '@ninno/utils';
import { JoinDraftStore } from '../join-draft.store';
import { JoinUploader } from '../join-uploader';
import { fieldError } from './field-error';

@Component({
  selector: 'nn-step-about',
  imports: [ReactiveFormsModule, NnChoiceCards, NnField, NnInput, NnPhotoTile],
  template: `
    <div class="flex flex-col gap-5" [formGroup]="form">
      <nn-field
        fieldId="j-name"
        label="Full name, as on your ID"
        i18n-label
        [error]="error('fullName')"
      >
        <input
          nnInput
          id="j-name"
          formControlName="fullName"
          autocomplete="name"
          autocapitalize="words"
          aria-describedby="j-name-msg"
          [attr.aria-invalid]="!!error('fullName')"
        />
      </nn-field>
      <nn-field fieldId="j-dob" label="Date of birth" i18n-label [error]="error('dob')">
        <input
          nnInput
          id="j-dob"
          type="date"
          formControlName="dob"
          autocomplete="bday"
          min="1940-01-01"
          [max]="today"
          aria-describedby="j-dob-msg"
          [attr.aria-invalid]="!!error('dob')"
        />
      </nn-field>
      <nn-choice-cards
        legend="Gender"
        i18n-legend
        [options]="genders"
        [columns]="2"
        [value]="form.controls.gender.value || null"
        (valueChange)="
          form.controls.gender.setValue($any($event)); form.controls.gender.markAsTouched()
        "
        [error]="error('gender')"
      />
      <div>
        <p class="mb-2 text-sm font-medium" i18n>Selfie</p>
        <nn-photo-tile
          label="Take a selfie"
          i18n-label
          hint="Face the camera in good light, without sunglasses."
          i18n-hint
          capture="user"
          accept="image/*"
          [state]="uploads().selfie.state"
          [status]="uploads().selfie.status"
          [previewUrl]="uploads().selfie.previewUrl"
          [fileName]="uploads().selfie.fileName"
          [error]="uploads().selfie.error"
          (picked)="uploader.upload('selfie', $event)"
        />
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StepAbout {
  protected readonly form = inject(JoinDraftStore).about;
  protected readonly uploader = inject(JoinUploader);
  protected readonly uploads = this.uploader.views;
  protected readonly today = todayIst();
  protected readonly genders: Choice[] = [
    { value: 'FEMALE', label: $localize`Female` },
    { value: 'MALE', label: $localize`Male` },
    { value: 'OTHER', label: $localize`Other` },
  ];

  protected error(name: keyof typeof this.form.controls): string | null {
    return fieldError(this.form.controls[name]);
  }
}
