import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import {
  type ApiErrorBody,
  ErrorCode,
  UPLOAD_RULES,
  type UploadContentType,
  type UploadKind,
} from '@ninno/contracts';
import type { PhotoTileState } from '@ninno/ui';
import { browserCodec, compressImage } from './compress-image';
import { JoinApi, putFile } from './join.api';
import { JoinDraftStore } from './join-draft.store';

export interface UploadView {
  state: PhotoTileState;
  status: string;
  previewUrl: string | null;
  fileName: string | null;
  error: string | null;
}

const EMPTY: UploadView = {
  state: 'empty',
  status: '',
  previewUrl: null,
  fileName: null,
  error: null,
};

/**
 * Compresses and uploads each photo as soon as it is taken, so the final submit only
 * sends text. Previews live in memory only; after a reload a done upload shows its name.
 */
@Injectable()
export class JoinUploader {
  private readonly api = inject(JoinApi);
  private readonly store = inject(JoinDraftStore);
  private readonly urls: string[] = [];
  private token = '';

  readonly views = signal<Record<UploadKind, UploadView>>({
    selfie: EMPTY,
    'id-front': EMPTY,
    'id-back': EMPTY,
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.urls.forEach((url) => URL.revokeObjectURL(url)));
  }

  /** Shows already-uploaded files (from the device draft) as done. */
  open(token: string): void {
    this.token = token;
    const files = this.store.files();
    this.views.update((views) => {
      const next = { ...views };
      for (const kind of Object.keys(files) as UploadKind[]) {
        next[kind] = {
          ...EMPTY,
          state: 'done',
          status: $localize`Uploaded`,
          fileName: files[kind]?.name ?? null,
        };
      }
      return next;
    });
  }

  /** Starts a draft on first use (or when the saved one expired). */
  async ensureDraft(): Promise<string> {
    const current = this.store.draft();
    if (current && new Date(current.expiresAt) > new Date()) {
      return current.draftToken;
    }
    const draft = await this.api.createDraft(this.token);
    this.store.setDraft(draft);
    this.views.set({ selfie: EMPTY, 'id-front': EMPTY, 'id-back': EMPTY });
    return draft.draftToken;
  }

  async upload(kind: UploadKind, file: File): Promise<void> {
    const isPdf = file.type === 'application/pdf';
    const allowed: readonly string[] = UPLOAD_RULES.contentTypes[kind];
    if (!isPdf && !file.type.startsWith('image/')) {
      this.fail(kind, $localize`Choose a photo${kind === 'selfie' ? '' : ' or a PDF'}.`);
      return;
    }
    if (isPdf && !allowed.includes('application/pdf')) {
      this.fail(kind, $localize`The selfie must be a photo.`);
      return;
    }
    this.set(kind, { ...EMPTY, state: 'busy', status: $localize`Preparing…`, fileName: file.name });
    this.store.setFile(kind, null);
    try {
      const body: Blob = isPdf ? file : await compressImage(file, browserCodec);
      if (body.size > UPLOAD_RULES.maxBytes) {
        this.fail(kind, $localize`This file is larger than 5 MB. Please choose a smaller one.`);
        return;
      }
      const previewUrl = isPdf ? null : this.objectUrl(body);
      this.set(kind, {
        ...EMPTY,
        state: 'busy',
        status: $localize`Uploading… 0%`,
        previewUrl,
        fileName: file.name,
      });
      const contentType: UploadContentType = isPdf ? 'application/pdf' : 'image/jpeg';
      const draftToken = await this.ensureDraft();
      const target = await this.api.uploadUrl(this.token, draftToken, {
        kind,
        contentType,
        size: body.size,
      });
      await putFile(target, body, (percent) =>
        this.set(kind, {
          ...this.views()[kind],
          status: $localize`Uploading… ${percent}:percent:%`,
        }),
      );
      this.store.setFile(kind, { key: target.key, contentType, name: file.name });
      this.set(kind, { ...this.views()[kind], state: 'done', status: $localize`Uploaded` });
    } catch (error) {
      this.fail(kind, describeUploadError(error));
    }
  }

  /** Marks a tile as missing (used when Continue is tapped without it). */
  require(kind: UploadKind, message: string): void {
    if (this.views()[kind].state === 'empty') {
      this.set(kind, { ...EMPTY, error: message });
    }
  }

  /** After the server refused a file: ask for that photo again. */
  reset(kind: UploadKind, message: string): void {
    this.store.setFile(kind, null);
    this.set(kind, { ...EMPTY, error: message });
  }

  private fail(kind: UploadKind, message: string): void {
    const view = this.views()[kind];
    this.set(kind, {
      ...view,
      state: view.previewUrl || view.fileName ? 'error' : 'empty',
      status: message,
      error: message,
    });
  }

  private set(kind: UploadKind, view: UploadView): void {
    this.views.update((views) => ({ ...views, [kind]: view }));
  }

  private objectUrl(blob: Blob): string {
    const url = URL.createObjectURL(blob);
    this.urls.push(url);
    return url;
  }
}

function describeUploadError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) {
      return $localize`Upload failed. Check your connection and try again.`;
    }
    const code = (error.error as Partial<ApiErrorBody> | null)?.code;
    if (code === ErrorCode.FileTooLarge) {
      return $localize`This file is larger than 5 MB. Please choose a smaller one.`;
    }
  }
  return $localize`Upload failed. Please try again.`;
}
