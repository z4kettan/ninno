import { DynamicModule, Global, Inject, Module } from '@nestjs/common';
import type { AppConfig } from './env.schema';

export const APP_CONFIG = Symbol('APP_CONFIG');

/** Injects the validated {@link AppConfig}. */
export const InjectConfig = () => Inject(APP_CONFIG);

@Global()
@Module({})
export class ConfigModule {
  static forRoot(config: AppConfig): DynamicModule {
    return {
      module: ConfigModule,
      providers: [{ provide: APP_CONFIG, useValue: config }],
      exports: [APP_CONFIG],
    };
  }
}
