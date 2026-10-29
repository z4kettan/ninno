import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  model,
  output,
  viewChild,
} from '@angular/core';

const LENGTH = 6;

/** Browsers that support the WebOTP API expose this on `window`. */
interface OtpCredentialLike {
  code: string;
}

/**
 * A 6-digit code input. One real (visually hidden) input carries the value, so SMS autofill
 * (`autocomplete="one-time-code"`), paste and screen readers all work; the six boxes are a
 * picture of that value. Where the WebOTP API exists, an incoming SMS fills it automatically.
 */
@Component({
  selector: 'nn-otp-input',
  template: `
    <label [for]="id" class="sr-only">{{ label() }}</label>
    <!-- The real input covers the boxes (absolute inset-0), so a tap anywhere focuses it. -->
    <div class="relative">
      <div class="grid grid-cols-6 gap-2" aria-hidden="true">
        @for (slot of slots(); track $index) {
          <span
            class="grid h-14 place-items-center rounded-control border bg-surface text-2xl font-semibold num"
            [class.border-control]="!slot.active && !invalid()"
            [class.border-negative]="invalid()"
            [class.border-2]="slot.active"
            [class.border-accent]="slot.active && !invalid()"
            >{{ slot.digit }}</span
          >
        }
      </div>
      <input
        #field
        [id]="id"
        class="absolute inset-0 h-full w-full cursor-text opacity-0"
        type="text"
        inputmode="numeric"
        autocomplete="one-time-code"
        [attr.maxlength]="length"
        [attr.aria-invalid]="invalid()"
        [attr.aria-describedby]="describedBy() || null"
        [disabled]="disabled()"
        [value]="value()"
        (input)="onInput(field)"
        (focus)="focused = true"
        (blur)="focused = false"
      />
    </div>
  `,
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NnOtpInput {
  readonly label = input('6-digit code');
  readonly invalid = input(false);
  readonly disabled = input(false);
  readonly describedBy = input<string>('');
  readonly value = model('');
  /** Emits the code once all six digits are present. */
  readonly completed = output<string>();

  protected readonly length = LENGTH;
  protected readonly id = `nn-otp-${Math.random().toString(36).slice(2, 8)}`;
  protected focused = false;

  private readonly field = viewChild.required<ElementRef<HTMLInputElement>>('field');

  protected readonly slots = computed(() => {
    const value = this.value();
    return Array.from({ length: LENGTH }, (_, i) => ({
      digit: value[i] ?? '',
      active: i === Math.min(value.length, LENGTH - 1),
    }));
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => this.listenForSmsCode(destroyRef));
  }

  focus(): void {
    this.field().nativeElement.focus();
  }

  clear(): void {
    this.value.set('');
    this.field().nativeElement.value = '';
    this.focus();
  }

  protected onInput(field: HTMLInputElement): void {
    this.accept(field.value);
    field.value = this.value();
  }

  private accept(raw: string): void {
    const digits = raw.replace(/\D/g, '').slice(0, LENGTH);
    this.value.set(digits);
    if (digits.length === LENGTH) {
      this.completed.emit(digits);
    }
  }

  /** WebOTP: Chrome on Android can read the code from the SMS once the user taps "Allow". */
  private listenForSmsCode(destroyRef: DestroyRef): void {
    if (typeof window === 'undefined' || !('OTPCredential' in window) || !navigator.credentials) {
      return;
    }
    const abort = new AbortController();
    destroyRef.onDestroy(() => abort.abort());
    navigator.credentials
      .get({ otp: { transport: ['sms'] }, signal: abort.signal } as CredentialRequestOptions)
      .then((credential) => {
        const code = (credential as unknown as OtpCredentialLike | null)?.code;
        if (code) {
          this.accept(code);
        }
      })
      .catch(() => undefined);
  }
}
