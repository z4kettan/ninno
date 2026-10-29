import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { IST_TIME_ZONE } from '@ninno/utils';
import { type Clock, InjectClock } from '../../common/clock';
import { StorageService } from '../storage/storage.service';
import { PENDING_PREFIX } from './drafts.service';

/** Uploads of forms never submitted are deleted after this long. */
export const PENDING_MAX_AGE_MS = 24 * 60 * 60_000;

/** Deletes abandoned join-form uploads. Submitted files have already moved to residents/. */
@Injectable()
export class PendingSweepService {
  private readonly logger = new Logger(PendingSweepService.name);

  constructor(
    private readonly storage: StorageService,
    @InjectClock() private readonly clock: Clock,
  ) {}

  @Cron('30 3 * * *', { name: 'pending-uploads-sweep', timeZone: IST_TIME_ZONE })
  async runDaily(): Promise<void> {
    try {
      await this.sweep();
    } catch (error) {
      this.logger.error({ err: error }, 'pending uploads sweep failed');
    }
  }

  /** Returns how many files were deleted. */
  async sweep(): Promise<number> {
    const cutoff = new Date(this.clock.now().getTime() - PENDING_MAX_AGE_MS);
    const keys = await this.storage.listOlderThan(PENDING_PREFIX, cutoff);
    await this.storage.remove(keys);
    this.logger.log({ deleted: keys.length }, 'pending uploads swept');
    return keys.length;
  }
}
