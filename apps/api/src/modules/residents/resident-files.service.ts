import { HttpStatus, Injectable } from '@nestjs/common';
import { ErrorCode, type FileViewResponse, type ResidentFile } from '@ninno/contracts';
import type { TenantContext } from '../../common/auth/auth.decorators';
import { inHostelScope } from '../../common/auth/hostel-scope';
import { type Clock, InjectClock } from '../../common/clock';
import { AppException } from '../../common/errors/app.exception';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { StorageService } from '../storage/storage.service';

/** Signed view links last at most this long. */
export const VIEW_TTL_SECONDS = 300;

const notFound = () =>
  new AppException(ErrorCode.NotFound, HttpStatus.NOT_FOUND, 'File not found.');

/** Staff see selfies and IDs only through short-lived links, and every view is recorded. */
@Injectable()
export class ResidentFilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    @InjectClock() private readonly clock: Clock,
  ) {}

  async view(
    tenant: TenantContext,
    residentId: string,
    file: ResidentFile,
    actorUserId: string,
    ip: string | null,
  ): Promise<FileViewResponse> {
    const resident = await this.prisma.resident.findFirst({
      where: { AND: [{ id: residentId, deletedAt: null }, inHostelScope(tenant)] },
      include: {
        identityDocuments: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    if (!resident) {
      throw notFound();
    }
    const doc = resident.identityDocuments[0];
    const key =
      file === 'selfie' ? resident.photoKey : file === 'id-front' ? doc?.frontKey : doc?.backKey;
    if (!key) {
      throw notFound();
    }
    const contentType = key.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg';
    const signed = await this.storage.signView(
      key,
      contentType,
      VIEW_TTL_SECONDS,
      this.clock.now(),
    );
    await this.audit.log({
      action: file === 'selfie' ? 'photo.viewed' : 'document.viewed',
      entity: 'resident',
      entityId: resident.id,
      organizationId: resident.organizationId,
      actorUserId,
      ip,
      metadata: { file, hostelId: resident.hostelId, documentId: doc?.id ?? null },
    });
    return { url: signed.url, contentType, expiresAt: signed.expiresAt.toISOString() };
  }
}
