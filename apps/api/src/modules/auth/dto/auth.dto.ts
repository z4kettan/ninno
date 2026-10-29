import { ApiProperty } from '@nestjs/swagger';
import type { RequestOtpRequest, VerifyOtpRequest } from '@ninno/contracts';
import { IsString, Matches } from 'class-validator';
import { IsIndianMobile } from '../../../common/validation/validators';

export class RequestOtpDto implements RequestOtpRequest {
  @ApiProperty({ example: '98765 43210' })
  @IsString()
  @IsIndianMobile()
  phone!: string;
}

export class VerifyOtpDto implements VerifyOtpRequest {
  @ApiProperty({ example: '+919876543210' })
  @IsString()
  @IsIndianMobile()
  phone!: string;

  @ApiProperty({ example: '482913' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'must be 6 digits' })
  otp!: string;
}
