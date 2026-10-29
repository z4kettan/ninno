import { ApiProperty } from '@nestjs/swagger';
import type { UploadContentType, UploadKind, UploadUrlRequest } from '@ninno/contracts';
import { IsIn, IsInt, Min } from 'class-validator';

const KINDS: UploadKind[] = ['selfie', 'id-front', 'id-back'];
const CONTENT_TYPES: UploadContentType[] = ['image/jpeg', 'image/png', 'application/pdf'];

export class UploadUrlDto implements UploadUrlRequest {
  @ApiProperty({ enum: KINDS })
  @IsIn(KINDS)
  kind!: UploadKind;

  @ApiProperty({ enum: CONTENT_TYPES })
  @IsIn(CONTENT_TYPES)
  contentType!: UploadContentType;

  /** The 5 MB limit is checked by the service so it can answer FILE_TOO_LARGE. */
  @ApiProperty({ example: 734003 })
  @IsInt()
  @Min(1)
  size!: number;
}
