import { HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  type CreateDraftResponse,
  ErrorCode,
  UPLOAD_RULES,
  type UploadContentType,
  type UploadKind,
  type UploadUrlRequest,
  type UploadUrlResponse,
} from '@ninno/contracts';
import { randomUUID } from 'node:crypto';
import { type Clock, InjectClock } from '../../common/clock';
import { AppException } from '../../common/errors/app.exception';
import { InjectConfig } from '../../config/config.module';
import type { AppConfig } from '../../config/env.schema';
import { StorageService } from '../storage/storage.service';
import type { UsableLink } from './onboarding-links.service';

export const DRAFT_TTL_SECONDS = 24 * 60 * 60;

/** Where a draft's uploads wait until submission; swept daily when abandoned. */
export const PENDING_PREFIX = 'pending/';

interface DraftClaims {
  sub: string;
  /** Hostel the draft belongs to. */
  hid: string;
  typ: 'draft';
  iat: number;
}

export interface Draft {
  id: string;
  hostelId: string;
}

const EXTENSIONS: Record<UploadContentType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'application/pdf': 'pdf',
};

const draftExpired = () =>
  new AppException(
    ErrorCode.Unauthorized,
    HttpStatus.UNAUTHORIZED,
    'This form has expired. Please scan the QR code and start again.',
  );

/**
 * A draft lets someone without an account upload their selfie and ID before signing up.
 * Its token only grants uploading into `pending/<draftId>/` and submitting for one hostel,
 * and is typed so it can never pass as a session token.
 */
@Injectable()
export class DraftsService {
  constructor(
    private readonly jwt: JwtService,
    private readonly storage: StorageService,
    @InjectConfig() private readonly config: AppConfig,
    @InjectClock() private readonly clock: Clock,
  ) {}

  create(link: UsableLink): CreateDraftResponse {
    const now = this.clock.now();
    const id = randomUUID();
    const claims: DraftClaims = {
      sub: id,
      hid: link.hostelId,
      typ: 'draft',
      iat: Math.floor(now.getTime() / 1000),
    };
    const draftToken = this.jwt.sign(claims, {
      secret: this.config.auth.jwtAccessSecret,
      algorithm: 'HS256',
      expiresIn: DRAFT_TTL_SECONDS,
    });
    return {
      draftId: id,
      draftToken,
      expiresAt: new Date((claims.iat + DRAFT_TTL_SECONDS) * 1000).toISOString(),
    };
  }

  /** The draft behind a token, if it is valid, unexpired and for this link's hostel. */
  verify(token: string | undefined, link: UsableLink): Draft {
    if (!token) {
      throw draftExpired();
    }
    let claims: DraftClaims;
    try {
      claims = this.jwt.verify<DraftClaims>(token, {
        secret: this.config.auth.jwtAccessSecret,
        algorithms: ['HS256'],
        clockTimestamp: Math.floor(this.clock.now().getTime() / 1000),
      });
    } catch {
      throw draftExpired();
    }
    if (claims.typ !== 'draft' || typeof claims.sub !== 'string' || claims.hid !== link.hostelId) {
      throw draftExpired();
    }
    return { id: claims.sub, hostelId: claims.hid };
  }

  /** A signed PUT into this draft's folder, pinned to the declared type and size. */
  async signUpload(draft: Draft, request: UploadUrlRequest): Promise<UploadUrlResponse> {
    const allowed: readonly UploadContentType[] = UPLOAD_RULES.contentTypes[request.kind];
    if (!allowed.includes(request.contentType)) {
      throw new AppException(
        ErrorCode.FileInvalid,
        HttpStatus.BAD_REQUEST,
        request.kind === 'selfie'
          ? 'The selfie must be a JPEG or PNG photo.'
          : 'The ID must be a JPEG or PNG photo, or a PDF.',
      );
    }
    if (request.size > UPLOAD_RULES.maxBytes) {
      throw new AppException(
        ErrorCode.FileTooLarge,
        HttpStatus.BAD_REQUEST,
        'This file is larger than 5 MB. Please choose a smaller one.',
      );
    }
    const key = draftKey(draft, request.kind, request.contentType);
    const signed = await this.storage.signUpload(
      key,
      request.contentType,
      request.size,
      UPLOAD_RULES.urlTtlSeconds,
      this.clock.now(),
    );
    return {
      key,
      url: signed.url,
      headers: signed.headers,
      expiresAt: signed.expiresAt.toISOString(),
    };
  }
}

export function draftKey(draft: Draft, kind: UploadKind, contentType: UploadContentType): string {
  return `${draftFolder(draft)}${kind}-${randomUUID()}.${EXTENSIONS[contentType]}`;
}

export function draftFolder(draft: Draft): string {
  return `${PENDING_PREFIX}${draft.id}/`;
}
