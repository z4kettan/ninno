import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { NnField, NnInput } from '@ninno/ui';
import { JoinDraftStore } from '../join-draft.store';
import { fieldError } from './field-error';

@Component({
  selector: 'nn-step-emergency',
  imports: [ReactiveFormsModule, NnField, NnInput],
  template: `
    <div class="flex flex-col gap-5" [formGroup]="form">
      <nn-field fieldId="j-ec-name" label="Their name" i18n-label [error]="error('name')">
        <input
          nnInput
          id="j-ec-name"
          formControlName="name"
          autocapitalize="words"
          aria-describedby="j-ec-name-msg"
          [attr.aria-invalid]="!!error('name')"
        />
      </nn-field>
      <nn-field
        fieldId="j-ec-phone"
        label="Their mobile number"
        i18n-label
        [error]="error('phone')"
      >
        <input
          nnInput
          id="j-ec-phone"
          type="tel"
          inputmode="tel"
          formControlName="phone"
          aria-describedby="j-ec-phone-msg"
          [attr.aria-invalid]="!!error('phone')"
        />
      </nn-field>
      <nn-field
        fieldId="j-ec-rel"
        label="How are they related to you?"
        i18n-label
        hint="For example: Father, Mother, Brother, Guardian"
        i18n-hint
        [error]="error('relation')"
      >
        <input
          nnInput
          id="j-ec-rel"
          formControlName="relation"
          autocapitalize="words"
          aria-describedby="j-ec-rel-msg"
          [attr.aria-invalid]="!!error('relation')"
        />
      </nn-field>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StepEmergency {
  protected readonly form = inject(JoinDraftStore).emergency;

  protected error(name: keyof typeof this.form.controls): string | null {
    return fieldError(this.form.controls[name]);
  }
}
