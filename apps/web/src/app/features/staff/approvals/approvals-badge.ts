import { httpResource } from '@angular/common/http';
import { Injectable, computed } from '@angular/core';
import type { ApprovalCountResponse } from '@ninno/contracts';
import { API } from '../../../core/auth/auth.store';
import { settledValue } from '../../../core/http/settled-value';

/** Applications waiting for review, for the badge in the staff navigation. */
@Injectable()
export class ApprovalsBadge {
  private readonly resource = httpResource<ApprovalCountResponse>(() => `${API}/approvals/count`);

  private readonly value = settledValue(this.resource);
  readonly count = computed(() => this.value()?.count ?? 0);

  /** After a decision, or when the queue is opened. */
  refresh(): void {
    this.resource.reload();
  }
}
