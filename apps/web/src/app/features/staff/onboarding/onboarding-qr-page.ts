import { HttpClient, httpResource } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import type { HostelSummary, OnboardingLinkResponse } from '@ninno/contracts';
import {
  NnButton,
  NnCard,
  NnEmptyState,
  NnIcon,
  NnSkeleton,
  SheetService,
  ToastService,
} from '@ninno/ui';
import QRCode from 'qrcode';
import { firstValueFrom } from 'rxjs';
import { API, AuthStore } from '../../../core/auth/auth.store';
import { settledValue } from '../../../core/http/settled-value';
import { ConfirmSheet, type ConfirmData } from '../../shared/confirm-sheet';

/** The QR code as an SVG string; error correction M survives a slightly creased poster. */
export function qrSvg(url: string): Promise<string> {
  return QRCode.toString(url, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' });
}

/**
 * The hostel's join QR: shown on screen, printable as an A4 "Scan to join" poster,
 * and replaceable when an old printout should stop working.
 */
@Component({
  selector: 'nn-onboarding-qr-page',
  imports: [RouterLink, NnButton, NnCard, NnEmptyState, NnIcon, NnSkeleton],
  template: `
    <h1 class="text-2xl font-bold leading-tight" i18n>Onboarding QR</h1>
    <p class="mt-1 text-muted" i18n>
      New residents scan this code to fill in their details and ID from their own phone.
    </p>

    @if (!canManage()) {
      <nn-empty-state
        class="mt-6"
        heading="Ask an owner or manager"
        i18n-heading
        message="Only owners and managers can show or change the hostel's QR code."
        i18n-message
      />
    } @else {
      @if ((hostelList() ?? []).length > 1) {
        <label class="mt-6 block max-w-sm">
          <span class="mb-2 block text-sm font-medium" i18n>Hostel</span>
          <select
            class="block min-h-12 w-full rounded-control border border-control bg-surface px-3"
            [value]="hostelId()"
            (change)="hostelId.set($any($event.target).value)"
          >
            @for (h of hostelList(); track h.id) {
              <option [value]="h.id">{{ h.name }}</option>
            }
          </select>
        </label>
      }

      @if (linkValue(); as l) {
        <div
          class="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start"
        >
          <nn-card>
            <p class="text-lg font-semibold">{{ l.hostelName }}</p>
            <div
              class="mx-auto mt-4 aspect-square w-full max-w-60 [&_svg]:h-full [&_svg]:w-full"
              role="img"
              [attr.aria-label]="qrLabel(l.hostelName)"
              [innerHTML]="svg()"
            ></div>
            <div class="mt-4 flex items-center gap-2">
              <p class="min-w-0 flex-1 truncate text-sm text-muted" [title]="l.url">{{ l.url }}</p>
              <button nnButton variant="text" type="button" (click)="copy(l.url)">
                <nn-icon name="copy" [size]="18" />
                <span i18n>Copy</span>
              </button>
            </div>
            <p class="mt-2 text-sm text-muted num" i18n>
              Used by {{ l.useCount }} residents so far
            </p>
            <div class="mt-6 flex flex-col gap-2">
              <button nnButton [block]="true" type="button" (click)="print()" i18n>
                Print poster
              </button>
              <button
                nnButton
                variant="text"
                type="button"
                [loading]="rotating()"
                (click)="rotate()"
                i18n
              >
                Make a new QR code
              </button>
            </div>
          </nn-card>

          <section aria-labelledby="how-title" class="lg:pt-2">
            <h2 id="how-title" class="text-lg font-semibold" i18n>How residents join</h2>
            <ol class="mt-3 flex flex-col gap-4">
              <li class="flex gap-3">
                <span
                  class="grid size-7 shrink-0 place-items-center rounded-full bg-accent-soft text-sm font-semibold text-accent-ink num"
                  >1</span
                >
                <p i18n>
                  <span class="font-medium">They scan the poster</span> at reception with their
                  phone camera. No app to download.
                </p>
              </li>
              <li class="flex gap-3">
                <span
                  class="grid size-7 shrink-0 place-items-center rounded-full bg-accent-soft text-sm font-semibold text-accent-ink num"
                  >2</span
                >
                <p i18n>
                  <span class="font-medium">They fill in six short steps</span>: their details, a
                  selfie and one government ID, then confirm their number with an SMS code.
                </p>
              </li>
              <li class="flex gap-3">
                <span
                  class="grid size-7 shrink-0 place-items-center rounded-full bg-accent-soft text-sm font-semibold text-accent-ink num"
                  >3</span
                >
                <p i18n>
                  <span class="font-medium">You approve them</span> in
                  <a
                    routerLink="/admin/approvals"
                    class="font-medium text-accent-ink underline underline-offset-2"
                    >Approvals</a
                  >, choosing their bed and rent. They see the result on their phone.
                </p>
              </li>
            </ol>
            <p class="mt-6 text-sm text-muted" i18n>
              If a poster is lost or the code is shared where it shouldn't be, make a new QR code:
              the old one stops working at once.
            </p>
          </section>
        </div>

        <!-- Only visible when printing: one A4 page, black on white. -->
        <section class="nn-print-poster" aria-hidden="true">
          <p class="nn-print-poster__name">{{ l.hostelName }}</p>
          <div class="nn-print-poster__qr" [innerHTML]="svg()"></div>
          <p class="nn-print-poster__cta" i18n>Scan to join</p>
          <p class="nn-print-poster__hint" i18n>
            Open your phone camera, point it at the code, and fill in your details.
          </p>
        </section>
      } @else if (link.error() || hostels.error()) {
        <nn-empty-state
          class="mt-6"
          heading="Couldn't load the QR code"
          i18n-heading
          message="Check your connection and try again."
          i18n-message
        />
      } @else if (hostels.hasValue() && !hostelId()) {
        <nn-empty-state
          class="mt-6"
          heading="No hostel yet"
          i18n-heading
          message="Add a hostel first; its QR code appears here."
          i18n-message
        />
      } @else {
        <nn-skeleton class="mt-6 block aspect-square w-full max-w-md" />
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OnboardingQrPage {
  private readonly http = inject(HttpClient);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly sheet = inject(SheetService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthStore);

  protected readonly canManage = computed(() =>
    ['OWNER', 'MANAGER'].includes(this.auth.staffMembership()?.role ?? ''),
  );
  protected readonly hostels = httpResource<HostelSummary[]>(() =>
    this.canManage() ? `${API}/hostels` : undefined,
  );
  protected readonly hostelList = settledValue(this.hostels);
  protected readonly hostelId = linkedSignal(() => this.hostelList()?.[0]?.id ?? '');
  protected readonly link = httpResource<OnboardingLinkResponse>(() =>
    this.hostelId() ? `${API}/hostels/${this.hostelId()}/onboarding-link` : undefined,
  );
  protected readonly linkValue = settledValue(this.link);
  protected readonly svg = signal<SafeHtml>('');
  protected readonly rotating = signal(false);

  constructor() {
    effect(() => {
      const url = this.linkValue()?.url;
      if (!url) {
        return;
      }
      void qrSvg(url).then((markup) =>
        // Generated here from our own link, never from user input.
        this.svg.set(this.sanitizer.bypassSecurityTrustHtml(markup)),
      );
    });
  }

  protected qrLabel(hostel: string): string {
    return $localize`QR code to join ${hostel}:hostel:`;
  }

  protected async copy(url: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(url);
      this.toast.show($localize`Link copied`);
    } catch {
      this.toast.show($localize`Couldn't copy. Press and hold the link to copy it.`);
    }
  }

  protected print(): void {
    window.print();
  }

  protected async rotate(): Promise<void> {
    const ref = this.sheet.open<boolean, ConfirmData>(ConfirmSheet, {
      label: $localize`Make a new QR code`,
      data: {
        title: $localize`Make a new QR code?`,
        message: $localize`The current code, including printed posters, stops working at once. Print the new poster afterwards.`,
        confirm: $localize`Make a new code`,
      },
    });
    if (!(await firstValueFrom(ref.closed))) {
      return;
    }
    this.rotating.set(true);
    try {
      const fresh = await firstValueFrom(
        this.http.post<OnboardingLinkResponse>(
          `${API}/hostels/${this.hostelId()}/onboarding-link/rotate`,
          {},
        ),
      );
      this.link.set(fresh);
      this.toast.show($localize`New QR code ready. Old posters no longer work.`);
    } catch {
      this.toast.show($localize`Couldn't make a new code. Please try again.`);
    } finally {
      this.rotating.set(false);
    }
  }
}
