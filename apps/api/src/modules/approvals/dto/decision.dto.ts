import { ApiProperty } from '@nestjs/swagger';
import { type ApproveRequest, REJECTION_REASON_LIMITS, type RejectRequest } from '@ninno/contracts';
import { IsString, IsUUID, Length } from 'class-validator';
import { IsIsoCalendarDate, IsPaiseString, Trim } from '../../../common/validation/validators';

export class ApproveDto implements ApproveRequest {
  @IsUUID()
  bedId!: string;

  @ApiProperty({ example: '2026-03-10' })
  @IsIsoCalendarDate()
  checkInDate!: string;

  @ApiProperty({ example: '650000', description: 'Paise, as a string' })
  @IsPaiseString()
  monthlyRentPaise!: string;

  @ApiProperty({ example: '500000', description: 'Paise, as a string' })
  @IsPaiseString()
  securityDepositPaise!: string;
}

export class RejectDto implements RejectRequest {
  @ApiProperty({ example: 'ID photo is blurry, please retake it' })
  @Trim()
  @IsString()
  @Length(REJECTION_REASON_LIMITS.min, REJECTION_REASON_LIMITS.max)
  reason!: string;
}
