import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { NnField, NnInput } from '@ninno/ui';
import { JoinDraftStore } from '../join-draft.store';
import { lookupPincode } from '../pincode';
import { fieldError } from './field-error';

@Component({
  selector: 'nn-step-contact',
  imports: [ReactiveFormsModule, NnField, NnInput],
  template: `
    <div class="flex flex-col gap-5" [formGroup]="form">
      <nn-field
        fieldId="j-phone"
        label="Mobile number"
        i18n-label
        hint="We'll send a code to this number when you submit."
        i18n-hint
        [error]="error('phone')"
      >
        <input
          nnInput
          id="j-phone"
          type="tel"
          inputmode="tel"
          formControlName="phone"
          autocomplete="tel-national"
          placeholder="98765 43210"
          aria-describedby="j-phone-msg"
          [attr.aria-invalid]="!!error('phone')"
        />
      </nn-field>
      <nn-field
        fieldId="j-alt"
        label="Another number"
        i18n-label
        [optional]="true"
        [error]="error('altPhone')"
      >
        <input
          nnInput
          id="j-alt"
          type="tel"
          inputmode="tel"
          formControlName="altPhone"
          aria-describedby="j-alt-msg"
          [attr.aria-invalid]="!!error('altPhone')"
        />
      </nn-field>
      <nn-field
        fieldId="j-email"
        label="Email"
        i18n-label
        [optional]="true"
        [error]="error('email')"
      >
        <input
          nnInput
          id="j-email"
          type="email"
          inputmode="email"
          formControlName="email"
          autocomplete="email"
          aria-describedby="j-email-msg"
          [attr.aria-invalid]="!!error('email')"
        />
      </nn-field>

      <h2 class="mt-2 text-lg font-semibold" i18n>Permanent address</h2>
      <nn-field fieldId="j-line1" label="House and street" i18n-label [error]="error('line1')">
        <input
          nnInput
          id="j-line1"
          formControlName="line1"
          autocomplete="address-line1"
          aria-describedby="j-line1-msg"
          [attr.aria-invalid]="!!error('line1')"
        />
      </nn-field>
      <nn-field
        fieldId="j-line2"
        label="Area or landmark"
        i18n-label
        [optional]="true"
        [error]="error('line2')"
      >
        <input
          nnInput
          id="j-line2"
          formControlName="line2"
          autocomplete="address-line2"
          aria-describedby="j-line2-msg"
        />
      </nn-field>
      <nn-field
        fieldId="j-pin"
        label="Pincode"
        i18n-label
        [hint]="pinHint()"
        [error]="error('pincode')"
      >
        <input
          nnInput
          id="j-pin"
          inputmode="numeric"
          maxlength="6"
          formControlName="pincode"
          autocomplete="postal-code"
          aria-describedby="j-pin-msg"
          [attr.aria-invalid]="!!error('pincode')"
          (input)="onPincode()"
        />
      </nn-field>
      <div class="grid grid-cols-2 gap-3">
        <nn-field fieldId="j-city" label="City or district" i18n-label [error]="error('city')">
          <input
            nnInput
            id="j-city"
            formControlName="city"
            autocomplete="address-level2"
            aria-describedby="j-city-msg"
            [attr.aria-invalid]="!!error('city')"
          />
        </nn-field>
        <nn-field fieldId="j-state" label="State" i18n-label [error]="error('state')">
          <input
            nnInput
            id="j-state"
            formControlName="state"
            autocomplete="address-level1"
            aria-describedby="j-state-msg"
            [attr.aria-invalid]="!!error('state')"
          />
        </nn-field>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StepContact {
  protected readonly form = inject(JoinDraftStore).contact;
  protected readonly pinHint = signal<string | null>(null);
  private lastLookup = '';

  protected error(name: keyof typeof this.form.controls): string | null {
    return fieldError(this.form.controls[name]);
  }

  /** Fills city and state from the pincode; they stay editable, and typing always works. */
  protected async onPincode(): Promise<void> {
    const code = this.form.controls.pincode.value.trim();
    if (code.length !== 6 || code === this.lastLookup) {
      return;
    }
    this.lastLookup = code;
    this.pinHint.set($localize`Looking up the city…`);
    const place = await lookupPincode(code);
    if (this.form.controls.pincode.value.trim() !== code) {
      return;
    }
    if (place) {
      this.form.patchValue({ city: place.city, state: place.state });
      this.pinHint.set(null);
    } else {
      this.pinHint.set($localize`Type the city and state below.`);
    }
  }
}
