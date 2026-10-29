import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../storage/storage.module';
import { DraftsService } from './drafts.service';
import { OnboardingLinksController } from './onboarding-links.controller';
import { OnboardingLinksService } from './onboarding-links.service';
import { OnboardingController } from './onboarding.controller';
import { PendingSweepService } from './pending-sweep.service';
import { SubmissionService } from './submission.service';

@Module({
  // Secrets are passed per call from AppConfig, not registered globally.
  imports: [JwtModule.register({}), AuthModule, StorageModule],
  controllers: [OnboardingLinksController, OnboardingController],
  providers: [OnboardingLinksService, DraftsService, SubmissionService, PendingSweepService],
  exports: [OnboardingLinksService],
})
export class OnboardingModule {}
