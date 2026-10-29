import { httpResource, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ApprovalsBadge } from '../../features/staff/approvals/approvals-badge';
import { settledValue } from './settled-value';

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve));
  TestBed.tick();
}

describe('settledValue', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), ApprovalsBadge],
    });
  });

  it('is undefined while loading and after a failure, instead of throwing', async () => {
    const resource = httpResource<{ n: number }>(() => '/api/v1/thing', {
      injector: TestBed.inject(Injector),
    });
    const value = settledValue(resource);
    TestBed.tick();
    expect(value()).toBeUndefined();

    TestBed.inject(HttpTestingController)
      .expectOne('/api/v1/thing')
      .flush({ code: 'NOT_FOUND' }, { status: 404, statusText: 'Not Found' });
    await settle();
    expect(resource.error()).toBeTruthy();
    expect(() => resource.value()).toThrow();
    expect(value()).toBeUndefined();
  });

  it('keeps the approvals badge at 0 when the count cannot be loaded', async () => {
    const badge = TestBed.inject(ApprovalsBadge);
    TestBed.tick();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/v1/approvals/count')
      .flush(null, { status: 500, statusText: 'Server Error' });
    await settle();
    expect(badge.count()).toBe(0);
  });
});
