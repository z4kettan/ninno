import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import {
  ErrorCode,
  type RequestOtpResponse,
  UPLOAD_RULES,
  type UploadContentType,
  type UploadKind,
} from '@ninno/contracts';
import {
  ageOn,
  type E164Phone,
  idTypeNeedsBack,
  maskIdNumber,
  MIN_RESIDENT_AGE,
  normalizeIndianPhone,
  todayIst,
} from '@ninno/utils';
import { randomUUID } from 'node:crypto';
import { type Clock, InjectClock } from '../../common/clock';
import { AppException } from '../../common/errors/app.exception';
import type { RequestMeta } from '../../common/http/request-meta';
import { PrismaService } from '../../database/prisma.service';
import type { Hostel, Prisma } from '../../generated/prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthService, type LoginResult } from '../auth/auth.service';
import { OtpService } from '../auth/otp/otp.service';
import { sniffContentType, SNIFF_BYTES } from '../storage/file-sniffer';
import { cleanImage } from '../storage/image-cleaner';
import { StorageService } from '../storage/storage.service';
import { type Draft, draftFolder } from './drafts.service';
import type { OnboardingFilesDto, OnboardingFormDto, SubmitOnboardingDto } from './dto/submit.dto';
import type { UsableLink } from './onboarding-links.service';

const EXTENSION_TYPES: Record<string, UploadContentType> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  pdf: 'application/pdf',
};

interface CheckedFile {
  kind: UploadKind;
  key: string;
  type: UploadContentType;
}

interface StoredFiles {
  selfieKey: string;
  idFrontKey: string;
  idBackKey: string | null;
}

const fileInvalid = (message = 'One of the photos could not be read. Please upload it again.') =>
  new AppException(ErrorCode.FileInvalid, HttpStatus.BAD_REQUEST, message);

const alreadyRegistered = () =>
  new AppException(
    ErrorCode.AlreadyRegistered,
    HttpStatus.CONFLICT,
    'This number already has an application at this hostel. Please sign in instead.',
  );

const OTP_INVALID_MESSAGE = 'That code is wrong or has expired. Please try again.';

/** Turns a completed join form into a signed-up resident awaiting approval. */
@Injectable()
export class SubmissionService {
  private readonly logger = new Logger(SubmissionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly otp: OtpService,
    private readonly auth: AuthService,
    private readonly audit: AuditService,
    @InjectClock() private readonly clock: Clock,
  ) {}

  /** Sends the SIGNUP code to the number in the form. Signup may use any valid number. */
  async sendCode(
    link: UsableLink,
    rawPhone: string,
    meta: RequestMeta,
  ): Promise<RequestOtpResponse> {
    const phone = normalizeIndianPhone(rawPhone);
    const issued = await this.otp.issue(phone, 'SIGNUP', { deliver: true });
    await this.audit.log({
      action: 'onboarding.otp_requested',
      entity: 'hostel',
      entityId: link.hostelId,
      organizationId: link.organizationId,
      ip: meta.ip,
      metadata: { phone },
    });
    return issued;
  }

  /**
   * Checks everything that can be checked without the code first, so a typo in the
   * form never burns the code. Nothing is created unless the code is right.
   */
  async submit(
    link: UsableLink,
    draft: Draft,
    dto: SubmitOnboardingDto,
    meta: RequestMeta,
  ): Promise<LoginResult> {
    const { form } = dto;
    this.checkForm(form);
    const files = await this.checkFiles(draft, form, dto.files);
    const phone = normalizeIndianPhone(form.phone);

    const verified = await this.otp.verify(phone, 'SIGNUP', dto.otp);
    if (verified !== 'ok') {
      throw verified === 'locked'
        ? new AppException(
            ErrorCode.OtpLocked,
            HttpStatus.UNAUTHORIZED,
            'Too many wrong attempts. Request a new code.',
          )
        : new AppException(ErrorCode.OtpInvalid, HttpStatus.UNAUTHORIZED, OTP_INVALID_MESSAGE);
    }

    if (await this.hasOpenApplication(link.hostelId, phone)) {
      throw alreadyRegistered();
    }

    const residentId = randomUUID();
    const stored = await this.storeFiles(residentId, link.hostel, files);
    let userId: string;
    try {
      userId = await this.createApplication(link, residentId, phone, form, stored);
    } catch (error) {
      await this.removeQuietly(Object.values(stored).filter((k): k is string => k !== null));
      throw error;
    }
    await this.removeQuietly(files.map((f) => f.key));

    await this.audit.log({
      action: 'resident.applied',
      entity: 'resident',
      entityId: residentId,
      organizationId: link.organizationId,
      actorUserId: userId,
      ip: meta.ip,
      metadata: { hostelId: link.hostelId, idType: form.idDocument.type },
    });
    return this.auth.completeSignIn(userId, phone, meta, 'signup');
  }

  /** Rules that need today's date or more than one field. */
  private checkForm(form: OnboardingFormDto): void {
    const errors: { field: string; errors: string[] }[] = [];
    const today = todayIst(this.clock.now());
    if (form.dob > today) {
      errors.push({ field: 'form.dob', errors: ['cannot be in the future'] });
    } else if (ageOn(form.dob, today) < MIN_RESIDENT_AGE) {
      errors.push({
        field: 'form.dob',
        errors: [`residents must be at least ${MIN_RESIDENT_AGE}`],
      });
    }
    if (normalizeIndianPhone(form.emergencyContact.phone) === normalizeIndianPhone(form.phone)) {
      errors.push({
        field: 'form.emergencyContact.phone',
        errors: ['must be someone else’s number'],
      });
    }
    if (errors.length > 0) {
      throw new AppException(
        ErrorCode.ValidationFailed,
        HttpStatus.BAD_REQUEST,
        'Some fields are missing or invalid.',
        errors,
      );
    }
  }

  /** Each file must be in this draft's folder, present, within limits and really its type. */
  private async checkFiles(
    draft: Draft,
    form: OnboardingFormDto,
    keys: OnboardingFilesDto,
  ): Promise<CheckedFile[]> {
    const needsBack = idTypeNeedsBack(form.idDocument.type);
    if (needsBack && !keys.idBackKey) {
      throw new AppException(
        ErrorCode.ValidationFailed,
        HttpStatus.BAD_REQUEST,
        'Some fields are missing or invalid.',
        [{ field: 'files.idBackKey', errors: ['a photo of the back of this ID is required'] }],
      );
    }
    const wanted: [UploadKind, string | null | undefined][] = [
      ['selfie', keys.selfieKey],
      ['id-front', keys.idFrontKey],
      ['id-back', needsBack ? keys.idBackKey : null],
    ];
    const checked: CheckedFile[] = [];
    for (const [kind, key] of wanted) {
      if (key) {
        checked.push(await this.checkFile(draft, kind, key));
      }
    }
    return checked;
  }

  private async checkFile(draft: Draft, kind: UploadKind, key: string): Promise<CheckedFile> {
    const match = new RegExp(`^${draftFolder(draft)}${kind}-[0-9a-f-]{36}\\.(jpg|png|pdf)$`).exec(
      key,
    );
    if (!match) {
      throw fileInvalid();
    }
    const declared = EXTENSION_TYPES[match[1]];
    const allowed: readonly UploadContentType[] = UPLOAD_RULES.contentTypes[kind];
    const info = await this.storage.head(key);
    if (
      !info ||
      info.size === 0 ||
      info.size > UPLOAD_RULES.maxBytes ||
      !allowed.includes(declared)
    ) {
      throw fileInvalid();
    }
    const actual = sniffContentType(await this.storage.readHead(key, SNIFF_BYTES));
    if (actual !== declared) {
      throw fileInvalid(
        'One of the files is not the type it claims to be. Please upload a photo or PDF.',
      );
    }
    return { kind, key, type: declared };
  }

  /** Cleans images (no metadata, size capped, IDs watermarked) into the resident's folder. */
  private async storeFiles(
    residentId: string,
    hostel: Hostel,
    files: CheckedFile[],
  ): Promise<StoredFiles> {
    const stored: Partial<Record<UploadKind, string>> = {};
    try {
      for (const file of files) {
        const original = await this.storage.read(file.key);
        let body: Buffer;
        let type: 'image/jpeg' | 'application/pdf';
        if (file.type === 'application/pdf') {
          body = original;
          type = 'application/pdf';
        } else {
          body = await cleanImage(original, {
            watermark: file.kind === 'selfie' ? undefined : `For ${hostel.name} KYC only`,
          }).catch(() => {
            throw fileInvalid();
          });
          type = 'image/jpeg';
        }
        const key = `residents/${residentId}/${file.kind}-${randomUUID()}.${type === 'application/pdf' ? 'pdf' : 'jpg'}`;
        await this.storage.write(key, body, type);
        stored[file.kind] = key;
      }
    } catch (error) {
      await this.removeQuietly(Object.values(stored));
      throw error;
    }
    return {
      selfieKey: stored.selfie as string,
      idFrontKey: stored['id-front'] as string,
      idBackKey: stored['id-back'] ?? null,
    };
  }

  private async hasOpenApplication(hostelId: string, phone: E164Phone): Promise<boolean> {
    const open = await this.prisma.resident.count({
      where: {
        hostelId,
        status: { in: ['PENDING_REVIEW', 'ACTIVE'] },
        deletedAt: null,
        user: { phone },
      },
    });
    return open > 0;
  }

  /** One transaction: user, membership, application, ID record and the link's use count. */
  private createApplication(
    link: UsableLink,
    residentId: string,
    phone: E164Phone,
    form: OnboardingFormDto,
    files: StoredFiles,
  ): Promise<string> {
    const now = this.clock.now();
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.upsert({
        where: { phone },
        create: { phone, name: form.fullName, email: form.email ?? null },
        // A verified phone may bring back a deactivated account; its name stays as it was.
        update: { deletedAt: null },
      });
      // Serialises concurrent submissions for the same person, then re-checks duplicates.
      await tx.$executeRaw`SELECT 1 FROM users WHERE id = ${user.id}::uuid FOR UPDATE`;
      const open = await tx.resident.count({
        where: {
          userId: user.id,
          hostelId: link.hostelId,
          status: { in: ['PENDING_REVIEW', 'ACTIVE'] },
          deletedAt: null,
        },
      });
      if (open > 0) {
        throw alreadyRegistered();
      }

      await this.ensureResidentMembership(tx, user.id, link);

      await tx.resident.create({
        data: {
          id: residentId,
          organizationId: link.organizationId,
          hostelId: link.hostelId,
          userId: user.id,
          status: 'PENDING_REVIEW',
          fullName: form.fullName,
          dob: new Date(`${form.dob}T00:00:00Z`),
          gender: form.gender,
          phone,
          altPhone: form.altPhone ? normalizeIndianPhone(form.altPhone) : null,
          email: form.email ?? null,
          permanentAddress: {
            line1: form.permanentAddress.line1,
            line2: form.permanentAddress.line2 ?? null,
            city: form.permanentAddress.city,
            state: form.permanentAddress.state,
            pincode: form.permanentAddress.pincode,
          },
          occupationType: form.occupationType,
          institutionOrCompany: form.institutionOrCompany ?? null,
          emergencyContactName: form.emergencyContact.name,
          emergencyContactPhone: normalizeIndianPhone(form.emergencyContact.phone),
          emergencyContactRelation: form.emergencyContact.relation,
          photoKey: files.selfieKey,
          consentAcceptedAt: now,
          consentVersion: form.consentVersion,
        },
      });
      await tx.identityDocument.create({
        data: {
          organizationId: link.organizationId,
          residentId,
          type: form.idDocument.type,
          numberMasked: maskIdNumber(form.idDocument.type, form.idDocument.idNumber),
          frontKey: files.idFrontKey,
          backKey: files.idBackKey,
        },
      });

      // Guarded so a link that was rotated, expired or used up meanwhile can't be overused.
      const counted = await tx.$executeRaw`
        UPDATE onboarding_links
        SET use_count = use_count + 1, updated_at = ${now}
        WHERE id = ${link.id}::uuid
          AND is_active
          AND (expires_at IS NULL OR expires_at > ${now})
          AND (max_uses IS NULL OR use_count < max_uses)`;
      if (counted !== 1) {
        throw new AppException(
          ErrorCode.LinkInvalid,
          HttpStatus.NOT_FOUND,
          'This join link is not valid any more. Ask the hostel for its current QR code.',
        );
      }
      return user.id;
    });
  }

  /** Adds a RESIDENT membership unless the person already belongs to this hostel. */
  private async ensureResidentMembership(
    tx: Prisma.TransactionClient,
    userId: string,
    link: UsableLink,
  ): Promise<void> {
    const key = {
      userId_organizationId_hostelId: {
        userId,
        organizationId: link.organizationId,
        hostelId: link.hostelId,
      },
    };
    const existing = await tx.membership.findUnique({ where: key });
    if (!existing) {
      await tx.membership.create({
        data: {
          userId,
          organizationId: link.organizationId,
          hostelId: link.hostelId,
          role: 'RESIDENT',
        },
      });
    } else if (existing.deletedAt) {
      await tx.membership.update({ where: key, data: { role: 'RESIDENT', deletedAt: null } });
    }
  }

  private async removeQuietly(keys: string[]): Promise<void> {
    if (keys.length === 0) {
      return;
    }
    try {
      await this.storage.remove(keys);
    } catch (error) {
      // Leftovers under pending/ are swept daily; residents/ leftovers are unreferenced.
      this.logger.warn({ err: error, count: keys.length }, 'could not remove files');
    }
  }
}
