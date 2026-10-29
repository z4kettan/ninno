import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { APP_CONFIG } from '../../config/config.module';
import type { AppConfig } from '../../config/env.schema';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ApitxtOtpSender } from './otp/apitxt-otp-sender';
import { ConsoleOtpSender } from './otp/console-otp-sender';
import { OTP_SENDER } from './otp/otp-sender';
import { OtpService } from './otp/otp.service';
import { TokenService } from './tokens/token.service';

@Module({
  // Secrets are passed per call from AppConfig, not registered globally.
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    OtpService,
    TokenService,
    {
      provide: OTP_SENDER,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) =>
        config.otp.sender === 'apitxt'
          ? new ApitxtOtpSender(config.otp.apitxt)
          : new ConsoleOtpSender(),
    },
  ],
  // OtpService is reused by onboarding signup (Phase 2); TokenService by the global auth guard.
  exports: [OtpService, TokenService],
})
export class AuthModule {}
