import { ChangeDetectionStrategy, Component, Directive, input } from '@angular/core';

/**
 * The look of every text input, select and textarea: 48px tall, control-grey outline,
 * red outline when `aria-invalid` is set. Keeps the native element, so autofill,
 * keyboards and accessibility come from the platform.
 */
@Directive({
  selector: 'input[nnInput], select[nnInput], textarea[nnInput]',
  host: {
    class:
      'block w-full min-h-12 rounded-control border border-control bg-surface px-3 text-base text-text ' +
      'outline-none placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 ' +
      'focus-visible:outline-accent aria-[invalid=true]:border-negative disabled:bg-raised disabled:text-muted',
  },
})
export class NnInput {}

/**
 * Label, optional hint and error around one projected control. Give the control
 * `[id]="fieldId"` and `[attr.aria-describedby]="fieldId + '-msg'"`.
 */
@Component({
  selector: 'nn-field',
  template: `
    <label [for]="fieldId()" class="mb-2 block text-sm font-medium">
      {{ label() }}
      @if (optional()) {
        <span class="font-normal text-muted" i18n>(optional)</span>
      }
    </label>
    <ng-content />
    <p
      [id]="fieldId() + '-msg'"
      class="mt-2 text-sm empty:hidden"
      [class.text-negative]="!!error()"
      [class.text-muted]="!error()"
    >
      {{ error() ?? hint() ?? '' }}
    </p>
  `,
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NnField {
  readonly fieldId = input.required<string>();
  readonly label = input.required<string>();
  readonly hint = input<string | null>(null);
  readonly error = input<string | null>(null);
  readonly optional = input(false);
}
