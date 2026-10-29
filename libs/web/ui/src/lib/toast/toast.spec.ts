import { TestBed } from '@angular/core/testing';
import { NnToastHost, ToastService } from './toast';

describe('Toasts', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('announces in a polite live region and dismisses itself after 4 seconds', async () => {
    const fixture = TestBed.createComponent(NnToastHost);
    const service = TestBed.inject(ToastService);
    const host = fixture.nativeElement as HTMLElement;
    expect(host.getAttribute('aria-live')).toBe('polite');

    service.show('Saved');
    fixture.detectChanges();
    expect(host.textContent).toContain('Saved');

    vi.advanceTimersByTime(4000);
    fixture.detectChanges();
    expect(host.textContent).not.toContain('Saved');
  });

  it('keeps at most three toasts', () => {
    const service = TestBed.inject(ToastService);
    for (const m of ['a', 'b', 'c', 'd']) {
      service.show(m);
    }
    expect(service.toasts().map((t) => t.message)).toEqual(['b', 'c', 'd']);
  });

  it('can be dismissed by hand', async () => {
    const fixture = TestBed.createComponent(NnToastHost);
    TestBed.inject(ToastService).show('Code sent', 'success');
    fixture.detectChanges();
    (
      fixture.nativeElement.querySelector('button[aria-label="Dismiss"]') as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Code sent');
  });
});
