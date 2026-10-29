import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { isValidIndianPhone, maskPhone } from '@ninno/utils';
import { NnButton, NnMark, NnOtpInput, NnPhoneField } from '@ninno/ui';
import { describeLoginError } from '../../core/auth/auth-errors';
import { AuthStore, landingPath } from '../../core/auth/auth.store';

type Step = 'phone' | 'code';

/** Only same-site paths are honoured, so `?next=` can't send anyone off-site. */
export function safeNext(next: string | undefined): string | null {
  return next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/login')
    ? next
    : null;
}

@Component({
  selector: 'nn-login-page',
  imports: [NnButton, NnMark, NnOtpInput, NnPhoneField],
  template: `
    <main
      class="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 pb-8 pt-6 lg:justify-center lg:pb-24"
    >
      <nn-mark [wordmark]="true" />

      @if (step() === 'phone') {
        <form class="flex flex-col gap-6" (submit)="$event.preventDefault(); sendCode()" novalidate>
          <div>
            <h1 class="text-2xl font-bold leading-tight" i18n>Sign in with your mobile number</h1>
            <p class="mt-2 text-muted" i18n>We'll send a 6-digit code by SMS.</p>
          </div>
          <nn-phone-field [(value)]="phone" [error]="phoneError()" />
          <button nnButton type="submit" [block]="true" [loading]="busy()" i18n>Send code</button>
          <p class="text-sm text-muted" i18n>New here? Scan the QR code at your hostel to join.</p>
        </form>
      } @else {
        <form class="flex flex-col gap-6" (submit)="$event.preventDefault(); verify()" novalidate>
          <div>
            <h1 class="text-2xl font-bold leading-tight" i18n>Enter the code</h1>
            <p class="mt-2 text-muted">
              <span i18n>Sent to</span> <span class="num">{{ masked() }}</span>
            </p>
          </div>

          <nn-otp-input
            #otp
            [(value)]="code"
            [invalid]="!!codeError()"
            [disabled]="locked()"
            describedBy="code-message"
            (completed)="verify()"
          />

          <p
            id="code-message"
            class="min-h-6 text-sm"
            [class.text-negative]="!!codeError()"
            aria-live="polite"
          >
            {{ codeError() }}
          </p>

          @if (locked()) {
            <button
              nnButton
              type="button"
              [block]="true"
              [loading]="busy()"
              (click)="resend()"
              i18n
            >
              Send a new code
            </button>
          } @else {
            <button
              nnButton
              type="submit"
              [block]="true"
              [loading]="busy()"
              [disabled]="code().length !== 6"
              i18n
            >
              Verify and sign in
            </button>
          }

          <div class="flex items-center justify-between gap-4">
            @if (secondsLeft() > 0) {
              <p class="text-sm text-muted num" aria-live="off">
                <span i18n>Resend code in</span> 0:{{ secondsLeft().toString().padStart(2, '0') }}
              </p>
            } @else if (!locked()) {
              <button nnButton variant="text" type="button" (click)="resend()" i18n>
                Resend code
              </button>
            } @else {
              <span></span>
            }
            <button nnButton variant="text" type="button" (click)="changeNumber()" i18n>
              Change number
            </button>
          </div>
        </form>
      }
    </main>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage {
  /** From `?next=`: where to go after signing in. */
  readonly next = input<string>();

  private readonly store = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly otp = viewChild<NnOtpInput>('otp');
  private timer: ReturnType<typeof setInterval> | undefined;

  protected readonly step = signal<Step>('phone');
  protected readonly phone = signal('');
  protected readonly code = signal('');
  protected readonly busy = signal(false);
  protected readonly phoneError = signal<string | null>(null);
  protected readonly codeError = signal<string | null>(null);
  protected readonly locked = signal(false);
  protected readonly secondsLeft = signal(0);
  protected readonly masked = computed(() => maskPhone(`+91${this.phone()}`));

  constructor() {
    inject(DestroyRef).onDestroy(() => clearInterval(this.timer));
  }

  protected async sendCode(): Promise<void> {
    if (!isValidIndianPhone(this.phone())) {
      this.phoneError.set($localize`Enter a 10-digit Indian mobile number.`);
      return;
    }
    this.phoneError.set(null);
    this.busy.set(true);
    try {
      const { resendAfterSeconds } = await this.store.requestCode(this.phone());
      this.step.set('code');
      this.startCountdown(resendAfterSeconds);
    } catch (error) {
      const described = describeLoginError(error);
      if (described.retryAfterSeconds) {
        // A code was sent moments ago: go to the code screen and wait out the cooldown.
        this.step.set('code');
        this.startCountdown(described.retryAfterSeconds);
      } else {
        this.phoneError.set(described.message);
      }
    } finally {
      this.busy.set(false);
    }
  }

  protected async verify(): Promise<void> {
    if (this.code().length !== 6 || this.busy() || this.locked()) {
      return;
    }
    this.busy.set(true);
    this.codeError.set(null);
    try {
      await this.store.verifyCode(this.phone(), this.code());
      await this.router.navigateByUrl(safeNext(this.next()) ?? landingPath(this.store.area()));
    } catch (error) {
      const described = describeLoginError(error);
      this.codeError.set(described.message);
      this.locked.set(described.code === 'OTP_LOCKED');
      this.otp()?.clear();
    } finally {
      this.busy.set(false);
    }
  }

  protected async resend(): Promise<void> {
    this.busy.set(true);
    try {
      const { resendAfterSeconds } = await this.store.requestCode(this.phone());
      this.locked.set(false);
      this.codeError.set(null);
      this.otp()?.clear();
      this.startCountdown(resendAfterSeconds);
    } catch (error) {
      const described = describeLoginError(error);
      this.codeError.set(described.message);
      if (described.retryAfterSeconds) {
        this.startCountdown(described.retryAfterSeconds);
      }
    } finally {
      this.busy.set(false);
    }
  }

  protected changeNumber(): void {
    clearInterval(this.timer);
    this.secondsLeft.set(0);
    this.code.set('');
    this.codeError.set(null);
    this.locked.set(false);
    this.step.set('phone');
  }

  private startCountdown(seconds: number): void {
    clearInterval(this.timer);
    this.secondsLeft.set(seconds);
    this.timer = setInterval(() => {
      this.secondsLeft.update((s) => Math.max(0, s - 1));
      if (this.secondsLeft() === 0) {
        clearInterval(this.timer);
      }
    }, 1000);
  }
}
