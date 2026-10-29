import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  type FileViewResponse,
  REJECTION_REASON_LIMITS,
  type ResidentFile,
} from '@ninno/contracts';
import { NnButton, NnField, NnInput } from '@ninno/ui';
import { firstValueFrom } from 'rxjs';
import { API } from '../../../core/auth/auth.store';

export interface FileSheetData {
  residentId: string;
  file: ResidentFile;
  title: string;
}

/** Opens one ID photo through a fresh 5-minute link (each open is audited). */
@Component({
  selector: 'nn-file-sheet',
  imports: [NnButton],
  template: `
    <div class="mx-auto mb-3 h-1 w-10 rounded-full bg-border" aria-hidden="true"></div>
    <h2 class="text-lg font-semibold">{{ data.title }}</h2>
    @if (view(); as v) {
      @if (v.contentType === 'application/pdf') {
        <p class="mt-3 text-muted" i18n>This ID was uploaded as a PDF.</p>
        <a
          nnButton
          class="mt-4"
          [href]="v.url"
          target="_blank"
          rel="noopener noreferrer"
          [block]="true"
          i18n
        >
          Open the PDF
        </a>
      } @else {
        <img
          [src]="v.url"
          [alt]="data.title"
          class="mt-3 max-h-[70dvh] w-full rounded-control bg-raised object-contain"
        />
      }
      <p class="mt-3 text-sm text-muted" i18n>
        This view is recorded. The link expires in 5 minutes.
      </p>
    } @else if (failed()) {
      <p class="mt-3 text-negative" i18n>Couldn't open the file. Please try again.</p>
    } @else {
      <div class="mt-3 aspect-[4/3] w-full animate-pulse rounded-control bg-raised"></div>
    }
    <button nnButton variant="secondary" class="mt-4" [block]="true" (click)="ref.close()" i18n>
      Close
    </button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FileSheet {
  protected readonly data = inject<FileSheetData>(DIALOG_DATA);
  protected readonly ref = inject(DialogRef);
  protected readonly view = signal<FileViewResponse | null>(null);
  protected readonly failed = signal(false);

  constructor() {
    firstValueFrom(
      inject(HttpClient).get<FileViewResponse>(
        `${API}/residents/${this.data.residentId}/files/${this.data.file}`,
      ),
    ).then(
      (view) => this.view.set(view),
      () => this.failed.set(true),
    );
  }
}

/** Asks for the reason the applicant will read. Closes with the reason, or undefined. */
@Component({
  selector: 'nn-reject-sheet',
  imports: [ReactiveFormsModule, NnButton, NnField, NnInput],
  template: `
    <div class="mx-auto mb-3 h-1 w-10 rounded-full bg-border" aria-hidden="true"></div>
    <form (submit)="$event.preventDefault(); confirm()" novalidate>
      <h2 class="text-lg font-semibold" i18n>Not approve this application?</h2>
      <p class="mt-1 text-muted" i18n>
        The applicant sees your reason and can scan the QR code to apply again.
      </p>
      <nn-field
        class="mt-4"
        fieldId="reject-reason"
        label="Reason"
        i18n-label
        hint="For example: ID photo is blurry, please retake it."
        i18n-hint
        [error]="error()"
      >
        <textarea
          nnInput
          id="reject-reason"
          rows="3"
          class="py-2"
          [formControl]="reason"
          [maxlength]="limits.max"
          aria-describedby="reject-reason-msg"
          [attr.aria-invalid]="!!error()"
        ></textarea>
      </nn-field>
      <div class="mt-6 flex flex-col gap-2">
        <button nnButton type="submit" [block]="true" i18n>Not approve</button>
        <button
          nnButton
          variant="secondary"
          type="button"
          [block]="true"
          (click)="ref.close()"
          i18n
        >
          Cancel
        </button>
      </div>
    </form>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RejectSheet {
  protected readonly ref = inject<DialogRef<string>>(DialogRef);
  protected readonly limits = REJECTION_REASON_LIMITS;
  protected readonly reason = new FormControl('', {
    nonNullable: true,
    validators: [
      Validators.required,
      Validators.minLength(REJECTION_REASON_LIMITS.min),
      Validators.maxLength(REJECTION_REASON_LIMITS.max),
    ],
  });
  protected readonly error = signal<string | null>(null);

  protected confirm(): void {
    const reason = this.reason.value.trim();
    if (reason.length < REJECTION_REASON_LIMITS.min) {
      this.error.set($localize`Write at least ${REJECTION_REASON_LIMITS.min}:min: characters.`);
      return;
    }
    this.ref.close(reason);
  }
}
