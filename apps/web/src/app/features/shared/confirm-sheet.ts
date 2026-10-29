import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NnButton } from '@ninno/ui';

export interface ConfirmData {
  title: string;
  message: string;
  confirm: string;
}

/** A yes/no question in a bottom sheet. Closes with `true` only when confirmed. */
@Component({
  selector: 'nn-confirm-sheet',
  imports: [NnButton],
  template: `
    <div class="mx-auto mb-3 h-1 w-10 rounded-full bg-border" aria-hidden="true"></div>
    <h2 class="text-lg font-semibold">{{ data.title }}</h2>
    <p class="mt-2 text-muted">{{ data.message }}</p>
    <div class="mt-6 flex flex-col gap-2">
      <button nnButton [block]="true" (click)="ref.close(true)">{{ data.confirm }}</button>
      <button nnButton variant="secondary" [block]="true" (click)="ref.close(false)" i18n>
        Cancel
      </button>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmSheet {
  protected readonly data = inject<ConfirmData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
}
