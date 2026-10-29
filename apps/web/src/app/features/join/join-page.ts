import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { type ApiErrorBody, ErrorCode, type PublicHostelResponse } from '@ninno/contracts';
import { NnButton, NnMark, NnOtpInput, NnPill, NnSkeleton, NnStepProgress } from '@ninno/ui';
import { maskPhone, normalizeIndianPhone } from '@ninno/utils';
import { describeLoginError } from '../../core/auth/auth-errors';
import { AuthStore } from '../../core/auth/auth.store';
import { JOIN_STEPS, JoinDraftStore, type JoinStep } from './join-draft.store';
import { JoinUploader } from './join-uploader';
import { JoinApi } from './join.api';
import { StepAbout } from './steps/step-about';
import { StepContact } from './steps/step-contact';
import { StepEmergency } from './steps/step-emergency';
import { StepId } from './steps/step-id';
import { StepReview } from './steps/step-review';
import { StepWork } from './steps/step-work';

type Stage = 'loading' | 'invalid' | 'offline' | 'form' | 'code' | 'registered';

const STEP_TEXT: Record<JoinStep, { title: string; lead: string; short: string }> = {
  about: {
    title: $localize`About you`,
    lead: $localize`Tell the hostel who you are.`,
    short: $localize`About you`,
  },
  contact: {
    title: $localize`How to reach you`,
    lead: $localize`Your number and your home address.`,
    short: $localize`Contact`,
  },
  work: {
    title: $localize`Work or study`,
    lead: $localize`Where you study or work.`,
    short: $localize`Work or study`,
  },
  emergency: {
    title: $localize`Emergency contact`,
    lead: $localize`Someone the hostel can call if something happens to you.`,
    short: $localize`Emergency contact`,
  },
  id: {
    title: $localize`Your ID`,
    lead: $localize`One government ID, so the hostel can confirm who you are.`,
    short: $localize`ID`,
  },
  review: {
    title: $localize`Check and submit`,
    lead: $localize`Look through your details before you send them.`,
    short: $localize`Review`,
  },
};

const GENDER_POLICY: Record<PublicHostelResponse['genderPolicy'], string> = {
  MALE: $localize`Men only`,
  FEMALE: $localize`Women only`,
  CO_LIVING: $localize`Co-living`,
};

/** Which step owns a field the server rejected. */
function stepForField(field: string): number {
  if (/^form\.(fullName|dob|gender)/.test(field)) return 1;
  if (/^form\.(phone|altPhone|email|permanentAddress)/.test(field)) return 2;
  if (/^form\.(occupationType|institutionOrCompany)/.test(field)) return 3;
  if (/^form\.emergencyContact/.test(field)) return 4;
  if (/^(form\.idDocument|files\.id)/.test(field)) return 5;
  if (/^files\.selfie/.test(field)) return 1;
  return 6;
}

@Component({
  selector: 'nn-join-page',
  imports: [
    RouterLink,
    NnButton,
    NnMark,
    NnOtpInput,
    NnPill,
    NnSkeleton,
    NnStepProgress,
    StepAbout,
    StepContact,
    StepWork,
    StepEmergency,
    StepId,
    StepReview,
  ],
  providers: [JoinDraftStore, JoinUploader],
  template: `
    <main
      class="mx-auto flex min-h-dvh max-w-md flex-col px-4 pt-4"
      [class.pb-32]="stage() === 'form'"
    >
      <header class="flex items-center justify-between gap-3 pb-4">
        <nn-mark [wordmark]="true" />
        @if (hostel() && step() > 0) {
          <span class="truncate text-sm text-muted">{{ hostel()?.name }}</span>
        }
      </header>

      @switch (stage()) {
        @case ('loading') {
          <nn-skeleton class="h-8 w-2/3" />
          <nn-skeleton class="mt-3 h-4 w-full" />
          <nn-skeleton class="mt-2 h-4 w-5/6" />
        }
        @case ('invalid') {
          <h1 class="text-2xl font-bold leading-tight" i18n>This QR code is no longer active</h1>
          <p class="mt-2" i18n>Ask the hostel for their current QR code and scan it again.</p>
        }
        @case ('offline') {
          <h1 class="text-2xl font-bold leading-tight" i18n>Can't reach Ninno</h1>
          <p class="mt-2" i18n>Check your internet connection, then try again.</p>
          <button nnButton class="mt-6" (click)="load()" i18n>Try again</button>
        }
        @case ('registered') {
          <h1 class="text-2xl font-bold leading-tight" i18n>You've already applied here</h1>
          <p class="mt-2" i18n>
            This number already has an application at {{ hostel()?.name }}. Sign in to see where it
            stands.
          </p>
          <a nnButton class="mt-6" routerLink="/login" i18n>Sign in</a>
        }
        @case ('code') {
          <form class="flex flex-col gap-6" (submit)="$event.preventDefault(); submit()" novalidate>
            <div>
              <h1 class="text-2xl font-bold leading-tight" i18n>Enter the code</h1>
              <p class="mt-2 text-muted">
                <span i18n>Sent by SMS to</span> <span class="num">{{ maskedPhone() }}</span>
              </p>
            </div>
            <nn-otp-input
              #otp
              [(value)]="code"
              [invalid]="!!codeError()"
              [disabled]="locked()"
              describedBy="code-message"
              (completed)="submit()"
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
                (click)="sendCode()"
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
                Submit
              </button>
            }
            <div class="flex items-center justify-between gap-4">
              @if (secondsLeft() > 0) {
                <p class="text-sm text-muted num">
                  <span i18n>Resend code in</span> 0:{{ secondsLeft().toString().padStart(2, '0') }}
                </p>
              } @else if (!locked()) {
                <button nnButton variant="text" type="button" (click)="sendCode()" i18n>
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
        @case ('form') {
          @if (step() === 0) {
            @if (hostel(); as h) {
              <h1 class="text-2xl font-bold leading-tight">{{ h.name }}</h1>
              <p class="mt-2 text-muted">{{ address() }}</p>
              <div class="mt-4 flex flex-wrap gap-2">
                <nn-pill tone="accent">{{ genderPolicy() }}</nn-pill>
                @for (amenity of h.amenities; track amenity) {
                  <nn-pill>{{ amenity }}</nn-pill>
                }
              </div>
              @if (h.rulesText) {
                <section class="mt-6">
                  <h2 class="text-lg font-semibold" i18n>House rules</h2>
                  <p class="mt-2 whitespace-pre-line">{{ h.rulesText }}</p>
                </section>
              }
              <div class="mt-8 border-t border-rule pt-6">
                <p class="font-medium" i18n>Join {{ h.name }} on Ninno</p>
                <p class="mt-1 text-muted" i18n>
                  It takes about 5 minutes. Keep your ID card ready, and you'll need to take a
                  selfie.
                </p>
                <button nnButton class="mt-4" [block]="true" (click)="go(1)" i18n>Start</button>
              </div>
            }
          } @else {
            <nn-step-progress [step]="step()" [total]="steps.length" [label]="current().short" />
            <h1 class="mt-5 text-2xl font-bold leading-tight">{{ current().title }}</h1>
            <p class="mt-1 text-muted">{{ current().lead }}</p>
            @if (banner()) {
              <p
                class="mt-4 rounded-control bg-[var(--pill-negative-bg)] px-3 py-2 text-[var(--pill-negative-ink)]"
                role="alert"
              >
                {{ banner() }}
              </p>
            }
            <div class="mt-6">
              @switch (steps[step() - 1]) {
                @case ('about') {
                  <nn-step-about />
                }
                @case ('contact') {
                  <nn-step-contact />
                }
                @case ('work') {
                  <nn-step-work />
                }
                @case ('emergency') {
                  <nn-step-emergency />
                }
                @case ('id') {
                  <nn-step-id />
                }
                @case ('review') {
                  <nn-step-review [hostelName]="hostel()?.name ?? ''" (edit)="go($event)" />
                }
              }
            </div>
            <div
              class="fixed inset-x-0 bottom-0 border-t border-border bg-surface px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))]"
            >
              <div class="mx-auto flex max-w-md items-center gap-3">
                <button nnButton variant="text" type="button" (click)="go(step() - 1)" i18n>
                  Back
                </button>
                <button nnButton type="button" class="flex-1" [loading]="busy()" (click)="next()">
                  {{ step() === steps.length ? verifyLabel : continueLabel }}
                </button>
              </div>
            </div>
          }
        }
      }
    </main>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JoinPage implements OnInit {
  readonly token = input.required<string>();

  private readonly api = inject(JoinApi);
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  protected readonly store = inject(JoinDraftStore);
  private readonly uploader = inject(JoinUploader);
  private readonly otp = viewChild<NnOtpInput>('otp');
  private timer: ReturnType<typeof setInterval> | undefined;

  protected readonly steps = JOIN_STEPS;
  protected readonly continueLabel = $localize`Continue`;
  protected readonly verifyLabel = $localize`Verify and submit`;

  protected readonly stage = signal<Stage>('loading');
  protected readonly hostel = signal<PublicHostelResponse | null>(null);
  protected readonly step = this.store.step;
  protected readonly banner = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly code = signal('');
  protected readonly codeError = signal<string | null>(null);
  protected readonly locked = signal(false);
  protected readonly secondsLeft = signal(0);

  protected readonly current = computed(() => STEP_TEXT[JOIN_STEPS[Math.max(this.step(), 1) - 1]]);
  protected readonly genderPolicy = computed(() => {
    const h = this.hostel();
    return h ? GENDER_POLICY[h.genderPolicy] : '';
  });
  protected readonly maskedPhone = signal('');
  protected readonly address = computed(() => {
    const h = this.hostel();
    return h
      ? [h.addressLine1, h.addressLine2, h.city, `${h.state} ${h.pincode}`]
          .filter(Boolean)
          .join(', ')
      : '';
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => clearInterval(this.timer));
  }

  ngOnInit(): void {
    this.store.open(this.token());
    this.uploader.open(this.token());
    void this.load();
  }

  protected async load(): Promise<void> {
    this.stage.set('loading');
    try {
      this.hostel.set(await this.api.hostel(this.token()));
      this.stage.set('form');
    } catch (error) {
      this.handleLinkError(error, 'offline');
    }
  }

  protected go(step: number): void {
    this.banner.set(null);
    this.store.setStep(Math.max(0, Math.min(step, JOIN_STEPS.length)));
    globalThis.scrollTo?.({ top: 0 });
  }

  /** Continue: checks this step, then moves on (or, on the last step, sends the code). */
  protected async next(): Promise<void> {
    const name = JOIN_STEPS[this.step() - 1];
    this.touch(name);
    if (Object.values(this.uploader.views()).some((v) => v.state === 'busy')) {
      this.banner.set($localize`Wait for the photo to finish uploading.`);
      return;
    }
    if (!this.store.stepValid(name)) {
      this.banner.set($localize`Some details are missing. Check the fields marked in red.`);
      return;
    }
    if (name !== 'review') {
      this.go(this.step() + 1);
      return;
    }
    const firstIncomplete = JOIN_STEPS.findIndex((s) => !this.store.stepValid(s));
    if (firstIncomplete >= 0 && firstIncomplete < JOIN_STEPS.length - 1) {
      this.go(firstIncomplete + 1);
      this.touch(JOIN_STEPS[firstIncomplete]);
      this.banner.set($localize`Some details are missing. Check the fields marked in red.`);
      return;
    }
    await this.sendCode();
  }

  protected async sendCode(): Promise<void> {
    this.busy.set(true);
    this.codeError.set(null);
    const phone = this.store.contact.controls.phone.value;
    try {
      const draftToken = await this.uploader.ensureDraft();
      const { resendAfterSeconds } = await this.api.verifyPhone(this.token(), draftToken, phone);
      this.maskedPhone.set(maskPhone(normalizeIndianPhone(phone)));
      this.locked.set(false);
      this.code.set('');
      this.otp()?.clear();
      this.stage.set('code');
      this.countdown(resendAfterSeconds);
    } catch (error) {
      const described = describeLoginError(error);
      if (described.retryAfterSeconds) {
        this.maskedPhone.set(maskPhone(normalizeIndianPhone(phone)));
        this.stage.set('code');
        this.countdown(described.retryAfterSeconds);
      } else if (!this.handleSubmitError(error)) {
        (this.stage() === 'code' ? this.codeError : this.banner).set(described.message);
      }
    } finally {
      this.busy.set(false);
    }
  }

  protected async submit(): Promise<void> {
    const draft = this.store.draft();
    if (this.code().length !== 6 || this.busy() || this.locked() || !draft) {
      return;
    }
    this.busy.set(true);
    this.codeError.set(null);
    try {
      const session = await this.api.submit(this.token(), draft.draftToken, {
        form: this.store.form(),
        files: this.store.fileKeys(),
        otp: this.code(),
      });
      this.store.clear();
      this.auth.acceptSession(session);
      await this.router.navigateByUrl('/home');
    } catch (error) {
      if (!this.handleSubmitError(error)) {
        const described = describeLoginError(error);
        this.codeError.set(described.message);
        this.locked.set(described.code === ErrorCode.OtpLocked);
        this.otp()?.clear();
      }
    } finally {
      this.busy.set(false);
    }
  }

  protected changeNumber(): void {
    clearInterval(this.timer);
    this.secondsLeft.set(0);
    this.stage.set('form');
    this.go(2);
  }

  private touch(step: JoinStep): void {
    const store = this.store;
    const groups = {
      about: store.about,
      contact: store.contact,
      work: store.work,
      emergency: store.emergency,
      id: store.id,
    } as const;
    if (step === 'review') {
      store.consent.markAsTouched();
      return;
    }
    groups[step].markAllAsTouched();
    const files = store.files();
    if (step === 'about' && !files.selfie) {
      this.uploader.require('selfie', $localize`Take a selfie to continue.`);
    }
    if (step === 'id' && store.id.controls.type.value) {
      if (!files['id-front']) {
        this.uploader.require('id-front', $localize`Add a photo of the front of your ID.`);
      }
      if (store.needsBack() && !files['id-back']) {
        this.uploader.require('id-back', $localize`Add a photo of the back of your ID.`);
      }
    }
  }

  /** Errors that send the resident somewhere else. Returns false for the caller to show. */
  private handleSubmitError(error: unknown): boolean {
    if (!(error instanceof HttpErrorResponse)) {
      return false;
    }
    const body = error.error as Partial<ApiErrorBody> | null;
    switch (body?.code) {
      case ErrorCode.LinkInvalid:
        this.store.clear();
        this.stage.set('invalid');
        return true;
      case ErrorCode.AlreadyRegistered:
        this.store.clear();
        this.stage.set('registered');
        return true;
      case ErrorCode.FileInvalid:
        this.uploader.reset('selfie', $localize`Please take this photo again.`);
        this.uploader.reset('id-front', $localize`Please take this photo again.`);
        this.uploader.reset('id-back', $localize`Please take this photo again.`);
        this.stage.set('form');
        this.go(1);
        this.banner.set($localize`One of your photos could not be read. Please add them again.`);
        return true;
      case ErrorCode.ValidationFailed: {
        const details = Array.isArray(body.details) ? body.details : [];
        const step = details.length ? Math.min(...details.map((d) => stepForField(d.field))) : 6;
        this.stage.set('form');
        this.go(step);
        this.touch(JOIN_STEPS[step - 1]);
        this.banner.set(
          details[0]
            ? $localize`Please check this step: ${details[0].errors[0]}:reason:.`
            : $localize`Some details are missing. Check the fields marked in red.`,
        );
        return true;
      }
      case ErrorCode.Unauthorized:
        // The draft expired (24 hours): its photos are gone too.
        this.store.forgetDraft();
        this.uploader.reset('selfie', $localize`Please take this photo again.`);
        this.uploader.reset('id-front', $localize`Please add this photo again.`);
        this.uploader.reset('id-back', $localize`Please add this photo again.`);
        this.stage.set('form');
        this.go(1);
        this.banner.set($localize`This form was open too long. Please add your photos again.`);
        return true;
      default:
        return false;
    }
  }

  private handleLinkError(error: unknown, fallback: Stage): void {
    const body = error instanceof HttpErrorResponse ? (error.error as Partial<ApiErrorBody>) : null;
    if (body?.code === ErrorCode.LinkInvalid) {
      this.store.clear();
      this.stage.set('invalid');
    } else {
      this.stage.set(fallback);
    }
  }

  private countdown(seconds: number): void {
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
