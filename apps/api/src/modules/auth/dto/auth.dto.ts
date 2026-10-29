import { ApiProperty } from '@nestjs/swagger';
import type { RequestOtpRequest, VerifyOtpRequest } from '@ninno/contracts';
import { isValidIndianPhone } from '@ninno/utils';
import { IsString, Matches, registerDecorator, type ValidationOptions } from 'class-validator';

function IsIndianMobile(options?: ValidationOptions): PropertyDecorator {
  return (target, propertyName) =>
    registerDecorator({
      name: 'isIndianMobile',
      target: target.constructor,
      propertyName: String(propertyName),
      options: { message: 'must be a 10-digit Indian mobile number', ...options },
      validator: {
        validate: (value: unknown) => typeof value === 'string' && isValidIndianPhone(value),
      },
    });
}

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
