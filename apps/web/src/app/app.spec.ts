import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { App } from './app';

describe('App', () => {
  it('creates the root with its banners and offline screen', async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), provideServiceWorker('ngsw-worker.js', { enabled: false })],
    }).compileComponents();
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('nn-update-banner')).not.toBeNull();
    expect(root.querySelector('nn-offline-screen')).not.toBeNull();
    expect(root.querySelector('nn-toast-host')).not.toBeNull();
  });
});
