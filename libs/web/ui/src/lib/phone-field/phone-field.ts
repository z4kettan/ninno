import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';

let nextId = 0;

/**
 * Indian mobile number with a fixed +91 prefix. `value` holds digits only (up to 10);
 * the field shows them as "98765 43210". Pasted "+91 98765-43210" or "098765..." is cleaned.
 */
@Component({
  selector: 'nn-phone-field',
  template: `
    <label [for]="id" class="mb-2 block text-sm font-medium">{{ label() }}</label>
    <div
      class="flex h-12 overflow-hidden rounded-control border bg-surface focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent"
      [class.border-control]="!error()"
      [class.border-negative]="!!error()"
    >
      <span
        class="grid place-items-center border-r border-border px-3 text-muted"
        aria-hidden="true"
        >+91</span
      >
      <input
        #field
        [id]="id"
        class="min-w-0 flex-1 bg-transparent px-3 text-lg outline-none"
        type="tel"
        inputmode="numeric"
        autocomplete="tel-national"
        [attr.aria-describedby]="error() ? id + '-error' : null"
        [attr.aria-invalid]="!!error()"
        [value]="display()"
        (input)="onInput(field)"
      />
    </div>
    @if (error()) {
      <p [id]="id + '-error'" class="mt-2 text-sm text-negative">{{ error() }}</p>
    }
  `,
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NnPhoneField {
  readonly label = input('Mobile number');
  readonly error = input<string | null>(null);
  /** Digits only, at most 10. */
  readonly value = model('');

  protected readonly id = `nn-phone-${nextId++}`;
  protected readonly display = computed(() => formatDigits(this.value()));

  protected onInput(field: HTMLInputElement): void {
    const digits = cleanDigits(field.value);
    this.value.set(digits);
    // Re-render the formatted value even when the digits didn't change (e.g. a typed space).
    field.value = formatDigits(digits);
  }
}

/** Strips formatting and the +91 / 91 / 0 prefixes, keeping at most 10 digits. */
export function cleanDigits(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.length > 10 && digits.startsWith('91')) {
    digits = digits.slice(2);
  } else if (digits.length > 10 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  return digits.slice(0, 10);
}

function formatDigits(digits: string): string {
  return digits.length > 5 ? `${digits.slice(0, 5)} ${digits.slice(5)}` : digits;
}
