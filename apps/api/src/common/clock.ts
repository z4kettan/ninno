import { Global, Inject, Module } from '@nestjs/common';

/** Source of "now", injectable so time-based rules (expiry, cooldowns) can be tested exactly. */
export interface Clock {
  now(): Date;
}

export const CLOCK = Symbol('CLOCK');
export const InjectClock = () => Inject(CLOCK);

export const systemClock: Clock = { now: () => new Date() };

@Global()
@Module({
  providers: [{ provide: CLOCK, useValue: systemClock }],
  exports: [CLOCK],
})
export class ClockModule {}
