import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  type AddressInput,
  CURRENT_CONSENT,
  type Gender,
  type OccupationType,
  ONBOARDING_LIMITS as L,
  type OnboardingFiles,
  type OnboardingForm,
  PINCODE_PATTERN,
  type SubmitOnboardingRequest,
  type VerifyPhoneRequest,
} from '@ninno/contracts';
import { ID_DOCUMENT_TYPES, type IdDocumentType } from '@ninno/utils';
import { Type } from 'class-transformer';
import {
  IsDefined,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  IsIdNumberForType,
  IsIndianMobile,
  IsIsoCalendarDate,
  Trim,
  TrimToNull,
} from '../../../common/validation/validators';

const GENDERS: Gender[] = ['MALE', 'FEMALE', 'OTHER'];
const OCCUPATIONS: OccupationType[] = ['STUDENT', 'WORKING', 'OTHER'];

export class VerifyPhoneDto implements VerifyPhoneRequest {
  @ApiProperty({ example: '98765 43210' })
  @IsString()
  @IsIndianMobile()
  phone!: string;
}

export class AddressDto implements AddressInput {
  @Trim()
  @IsString()
  @Length(1, L.addressLineMax)
  line1!: string;

  @ApiPropertyOptional()
  @TrimToNull()
  @IsOptional()
  @IsString()
  @MaxLength(L.addressLineMax)
  line2?: string | null;

  @Trim()
  @IsString()
  @Length(1, L.textMax)
  city!: string;

  @Trim()
  @IsString()
  @Length(1, L.textMax)
  state!: string;

  @ApiProperty({ example: '682030' })
  @Trim()
  @IsString()
  @Matches(PINCODE_PATTERN, { message: 'must be a 6-digit pincode' })
  pincode!: string;
}

export class EmergencyContactDto {
  @Trim()
  @IsString()
  @Length(L.nameMin, L.nameMax)
  name!: string;

  @IsString()
  @IsIndianMobile()
  phone!: string;

  @ApiProperty({ example: 'Father' })
  @Trim()
  @IsString()
  @Length(1, L.relationMax)
  relation!: string;
}

export class IdDocumentDto {
  @ApiProperty({ enum: ID_DOCUMENT_TYPES })
  @IsIn(ID_DOCUMENT_TYPES)
  type!: IdDocumentType;

  /** Checked here and masked by the service; never stored or logged in full. */
  @ApiProperty({ example: '2341 2341 2346' })
  @IsString()
  @IsIdNumberForType()
  idNumber!: string;
}

export class OnboardingFormDto implements OnboardingForm {
  @Trim()
  @IsString()
  @Length(L.nameMin, L.nameMax)
  fullName!: string;

  /** The minimum age is checked by the service against today's date in IST. */
  @ApiProperty({ example: '2004-08-24' })
  @IsIsoCalendarDate()
  dob!: string;

  @ApiProperty({ enum: GENDERS })
  @IsIn(GENDERS)
  gender!: Gender;

  @IsString()
  @IsIndianMobile()
  phone!: string;

  @ApiPropertyOptional()
  @TrimToNull()
  @IsOptional()
  @IsString()
  @IsIndianMobile()
  altPhone?: string | null;

  @ApiPropertyOptional()
  @TrimToNull()
  @IsOptional()
  @IsEmail({}, { message: 'must be a valid email address' })
  @MaxLength(L.emailMax)
  email?: string | null;

  @IsDefined()
  @ValidateNested()
  @Type(() => AddressDto)
  permanentAddress!: AddressDto;

  @ApiProperty({ enum: OCCUPATIONS })
  @IsIn(OCCUPATIONS)
  occupationType!: OccupationType;

  /** Required for students and working residents. */
  @ApiPropertyOptional()
  @TrimToNull()
  @ValidateIf(
    (form: OnboardingFormDto) => form.occupationType !== 'OTHER' || !!form.institutionOrCompany,
  )
  @IsString({ message: 'is required for students and working residents' })
  @Length(1, L.textMax)
  institutionOrCompany?: string | null;

  @IsDefined()
  @ValidateNested()
  @Type(() => EmergencyContactDto)
  emergencyContact!: EmergencyContactDto;

  @IsDefined()
  @ValidateNested()
  @Type(() => IdDocumentDto)
  idDocument!: IdDocumentDto;

  @ApiProperty({ example: CURRENT_CONSENT.version })
  @IsIn([CURRENT_CONSENT.version], { message: 'must accept the current consent text' })
  consentVersion!: string;
}

export class OnboardingFilesDto implements OnboardingFiles {
  @IsString()
  @MaxLength(200)
  selfieKey!: string;

  @IsString()
  @MaxLength(200)
  idFrontKey!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  idBackKey?: string | null;
}

export class SubmitOnboardingDto implements SubmitOnboardingRequest {
  @IsDefined()
  @ValidateNested()
  @Type(() => OnboardingFormDto)
  form!: OnboardingFormDto;

  @IsDefined()
  @ValidateNested()
  @Type(() => OnboardingFilesDto)
  files!: OnboardingFilesDto;

  @ApiProperty({ example: '482913' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'must be 6 digits' })
  otp!: string;
}
