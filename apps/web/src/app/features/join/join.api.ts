import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  type AuthSession,
  type CreateDraftResponse,
  DRAFT_TOKEN_HEADER,
  type PublicHostelResponse,
  type RequestOtpResponse,
  type SubmitOnboardingRequest,
  type UploadUrlRequest,
  type UploadUrlResponse,
} from '@ninno/contracts';
import { firstValueFrom } from 'rxjs';
import { API, SKIP_AUTH } from '../../core/auth/auth.store';

/** The public join endpoints; none of them uses the session. */
@Injectable({ providedIn: 'root' })
export class JoinApi {
  private readonly http = inject(HttpClient);
  private readonly context = new HttpContext().set(SKIP_AUTH, true);

  private path(token: string, rest = ''): string {
    return `${API}/onboarding/${encodeURIComponent(token)}${rest}`;
  }

  private draftOptions(draftToken: string) {
    return { context: this.context, headers: { [DRAFT_TOKEN_HEADER]: draftToken } };
  }

  hostel(token: string): Promise<PublicHostelResponse> {
    return firstValueFrom(
      this.http.get<PublicHostelResponse>(this.path(token), { context: this.context }),
    );
  }

  createDraft(token: string): Promise<CreateDraftResponse> {
    return firstValueFrom(
      this.http.post<CreateDraftResponse>(
        this.path(token, '/drafts'),
        {},
        { context: this.context },
      ),
    );
  }

  uploadUrl(token: string, draftToken: string, body: UploadUrlRequest): Promise<UploadUrlResponse> {
    return firstValueFrom(
      this.http.post<UploadUrlResponse>(
        this.path(token, '/uploads'),
        body,
        this.draftOptions(draftToken),
      ),
    );
  }

  verifyPhone(token: string, draftToken: string, phone: string): Promise<RequestOtpResponse> {
    return firstValueFrom(
      this.http.post<RequestOtpResponse>(
        this.path(token, '/verify-phone'),
        { phone },
        this.draftOptions(draftToken),
      ),
    );
  }

  submit(token: string, draftToken: string, body: SubmitOnboardingRequest): Promise<AuthSession> {
    return firstValueFrom(
      this.http.post<AuthSession>(this.path(token, '/submit'), body, this.draftOptions(draftToken)),
    );
  }
}

/**
 * PUTs a file straight to storage through a signed URL, reporting progress (0–100).
 * XHR rather than fetch: fetch has no upload progress.
 */
export function putFile(
  target: UploadUrlResponse,
  file: Blob,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', target.url);
    for (const [name, value] of Object.entries(target.headers)) {
      xhr.setRequestHeader(name, value);
    }
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`upload failed with ${xhr.status}`));
    xhr.onerror = () => reject(new Error('upload failed'));
    xhr.send(file);
  });
}
