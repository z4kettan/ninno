import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { NnButton, NnMark } from '@ninno/ui';
import { AuthStore } from '../../core/auth/auth.store';

/** Signed in, but the number belongs to no hostel yet (e.g. a removed membership). */
@Component({
  selector: 'nn-no-access-page',
  imports: [NnButton, NnMark],
  template: `
    <main class="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 pb-8 pt-6">
      <nn-mark [wordmark]="true" />
      <div>
        <h1 class="text-2xl font-bold leading-tight" i18n>
          Your number isn't linked to a hostel yet
        </h1>
        <p class="mt-2 text-muted" i18n>
          To join, scan the QR code at your hostel's reception. If you work at a hostel, ask the
          owner to add you.
        </p>
      </div>
      <button nnButton variant="secondary" type="button" (click)="signOut()" i18n>Sign out</button>
    </main>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NoAccessPage {
  private readonly store = inject(AuthStore);
  private readonly router = inject(Router);

  protected async signOut(): Promise<void> {
    await this.store.logout().catch(() => undefined);
    await this.router.navigateByUrl('/login');
  }
}
