import { TestBed } from '@angular/core/testing';
import { SwUpdate, type VersionEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { UpdateBanner } from './pwa-banners';
import { AppUpdateService, INSTALL_DISMISSED_KEY, InstallPromptService } from './pwa.services';

function fakeInstallEvent() {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: string }>;
  };
  event.prompt = vi.fn().mockResolvedValue(undefined);
  event.userChoice = Promise.resolve({ outcome: 'accepted' });
  return event;
}

describe('InstallPromptService', () => {
  beforeEach(() => localStorage.clear());

  it('offers installation when the browser does, and stops the browser’s own mini-bar', () => {
    const service = TestBed.inject(InstallPromptService);
    const event = fakeInstallEvent();
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(service.mode()).toBe('prompt');
  });

  it('shows only once per device: dismissing is remembered', () => {
    TestBed.inject(InstallPromptService).dismiss();
    expect(localStorage.getItem(INSTALL_DISMISSED_KEY)).toBe('1');

    TestBed.resetTestingModule();
    const again = TestBed.inject(InstallPromptService);
    window.dispatchEvent(fakeInstallEvent());
    expect(again.mode()).toBeNull();
  });

  it('runs the native prompt and then stops offering', async () => {
    const service = TestBed.inject(InstallPromptService);
    const event = fakeInstallEvent();
    window.dispatchEvent(event);
    await service.install();
    expect(event.prompt).toHaveBeenCalled();
    expect(service.mode()).toBeNull();
  });

  it('survives blocked storage (private mode)', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => TestBed.inject(InstallPromptService)).not.toThrow();
    getItem.mockRestore();
  });
});

describe('AppUpdateService and banner', () => {
  it('shows the banner only once a new version is ready', async () => {
    const versionUpdates = new Subject<VersionEvent>();
    TestBed.configureTestingModule({
      providers: [{ provide: SwUpdate, useValue: { isEnabled: true, versionUpdates } }],
    });
    const fixture = TestBed.createComponent(UpdateBanner);
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('new version');

    versionUpdates.next({ type: 'VERSION_DETECTED', version: { hash: 'b' } });
    await fixture.whenStable();
    expect(TestBed.inject(AppUpdateService).ready()).toBe(false);

    versionUpdates.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'a' },
      latestVersion: { hash: 'b' },
    });
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'A new version of Ninno is ready.',
    );
  });
});
