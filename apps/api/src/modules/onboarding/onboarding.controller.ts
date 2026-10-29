import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  type AuthSession,
  type CreateDraftResponse,
  DRAFT_TOKEN_HEADER,
  type PublicHostelResponse,
  type RequestOtpResponse,
  type UploadUrlResponse,
} from '@ninno/contracts';
import type { Request, Response } from 'express';
import { AuthThrottled, Public } from '../../common/auth/auth.decorators';
import { requestMeta } from '../../common/http/request-meta';
import { InjectConfig } from '../../config/config.module';
import type { AppConfig } from '../../config/env.schema';
import { setRefreshCookie } from '../auth/refresh-cookie';
import { DraftsService } from './drafts.service';
import { SubmitOnboardingDto, VerifyPhoneDto } from './dto/submit.dto';
import { UploadUrlDto } from './dto/upload.dto';
import { OnboardingLinksService } from './onboarding-links.service';
import { SubmissionService } from './submission.service';

/** The public join flow behind a hostel's QR code. Nothing here needs an account. */
@ApiTags('onboarding')
@Public()
@Controller('onboarding/:token')
export class OnboardingController {
  constructor(
    private readonly links: OnboardingLinksService,
    private readonly drafts: DraftsService,
    private readonly submission: SubmissionService,
    @InjectConfig() private readonly config: AppConfig,
  ) {}

  /** What anyone holding the QR code may see: the hostel's public details only. */
  @Get()
  async hostel(@Param('token') token: string): Promise<PublicHostelResponse> {
    const link = await this.links.findUsable(token);
    return this.links.publicHostel(link.hostel);
  }

  /** Starts a form: returns the draft token that uploads and submission need. */
  @AuthThrottled()
  @Post('drafts')
  async createDraft(@Param('token') token: string): Promise<CreateDraftResponse> {
    return this.drafts.create(await this.links.findUsable(token));
  }

  /** A short-lived signed URL to upload one photo or PDF straight to private storage. */
  @Post('uploads')
  @HttpCode(HttpStatus.OK)
  async uploadUrl(
    @Param('token') token: string,
    @Headers(DRAFT_TOKEN_HEADER) draftToken: string | undefined,
    @Body() dto: UploadUrlDto,
  ): Promise<UploadUrlResponse> {
    const link = await this.links.findUsable(token);
    const draft = this.drafts.verify(draftToken, link);
    return this.drafts.signUpload(draft, dto);
  }

  /** Sends the SMS code that confirms the number in the form. */
  @AuthThrottled()
  @Post('verify-phone')
  @HttpCode(HttpStatus.ACCEPTED)
  async verifyPhone(
    @Param('token') token: string,
    @Headers(DRAFT_TOKEN_HEADER) draftToken: string | undefined,
    @Body() dto: VerifyPhoneDto,
    @Req() req: Request,
  ): Promise<RequestOtpResponse> {
    const link = await this.links.findUsable(token);
    this.drafts.verify(draftToken, link);
    return this.submission.sendCode(link, dto.phone, requestMeta(req));
  }

  /** Submitting with the right code is signup: the resident is signed in, pending approval. */
  @AuthThrottled()
  @Post('submit')
  @HttpCode(HttpStatus.CREATED)
  async submit(
    @Param('token') token: string,
    @Headers(DRAFT_TOKEN_HEADER) draftToken: string | undefined,
    @Body() dto: SubmitOnboardingDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthSession> {
    const link = await this.links.findUsable(token);
    const draft = this.drafts.verify(draftToken, link);
    const { session, refresh } = await this.submission.submit(link, draft, dto, requestMeta(req));
    setRefreshCookie(res, refresh, this.config);
    return session;
  }
}
