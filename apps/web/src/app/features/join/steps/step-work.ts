import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { type Choice, NnChoiceCards, NnField, NnInput } from '@ninno/ui';
import { JoinDraftStore } from '../join-draft.store';
import { fieldError } from './field-error';

@Component({
  selector: 'nn-step-work',
  imports: [ReactiveFormsModule, NnChoiceCards, NnField, NnInput],
  template: `
    <div class="flex flex-col gap-5" [formGroup]="form">
      <nn-choice-cards
        legend="What do you do?"
        i18n-legend
        [options]="occupations"
        [value]="type() || null"
        (valueChange)="
          form.controls.occupationType.setValue($any($event));
          form.controls.occupationType.markAsTouched()
        "
        [error]="typeError()"
      />
      <nn-field
        fieldId="j-inst"
        [label]="institutionLabel()"
        [optional]="type() === 'OTHER'"
        [error]="institutionError()"
      >
        <input
          nnInput
          id="j-inst"
          formControlName="institutionOrCompany"
          autocomplete="organization"
          aria-describedby="j-inst-msg"
          [attr.aria-invalid]="!!institutionError()"
        />
      </nn-field>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StepWork {
  protected readonly form = inject(JoinDraftStore).work;
  protected readonly type = toSignal(this.form.controls.occupationType.valueChanges, {
    initialValue: this.form.controls.occupationType.value,
  });
  protected readonly occupations: Choice[] = [
    { value: 'STUDENT', label: $localize`Student` },
    { value: 'WORKING', label: $localize`Working` },
    { value: 'OTHER', label: $localize`Something else` },
  ];
  protected readonly institutionLabel = computed(() =>
    this.type() === 'WORKING'
      ? $localize`Company`
      : this.type() === 'STUDENT'
        ? $localize`College or institution`
        : $localize`College or company`,
  );

  protected typeError(): string | null {
    return fieldError(this.form.controls.occupationType);
  }

  protected institutionError(): string | null {
    return fieldError(this.form.controls.institutionOrCompany, 'institutionRequired');
  }
}
