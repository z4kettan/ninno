import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { OnboardingLinkResponse } from '@ninno/contracts';
import { AuthStore } from '../../../core/auth/auth.store';
import { OnboardingQrPage, qrSvg } from './onboarding-qr-page';

const link: OnboardingLinkResponse = {
  hostelId: 'h1',
  hostelName: 'Kayal House',
  token: 'tok',
  url: 'https://app.ninno.in/join/tok',
  expiresAt: null,
  maxUses: null,
  useCount: 3,
  createdAt: '2026-03-01T00:00:00Z',
};

/** Lets resources and promises settle, then runs change detection. */
async function settle(ms = 0): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
  TestBed.tick();
}

async function render(role: 'OWNER' | 'STAFF') {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
  });
  TestBed.inject(AuthStore).acceptSession({
    accessToken: 't',
    expiresInSeconds: 900,
    user: {
      id: 'u1',
      name: 'Owner',
      phoneMasked: '',
      memberships: [
        { organizationId: 'o1', organizationName: 'Org', hostelId: null, hostelName: null, role },
      ],
    },
  });
  const fixture = TestBed.createComponent(OnboardingQrPage);
  const http = TestBed.inject(HttpTestingController);
  TestBed.tick();
  return { fixture, http };
}

describe('OnboardingQrPage', () => {
  it('encodes the join link as an SVG QR code', async () => {
    const svg = await qrSvg(link.url);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('<path');
  });

  it('prepares a print poster with the hostel name, the QR code and "Scan to join"', async () => {
    const { fixture, http } = await render('OWNER');
    http.expectOne('/api/v1/hostels').flush([{ id: 'h1', name: 'Kayal House', city: 'Kochi' }]);
    await settle();
    http.expectOne('/api/v1/hostels/h1/onboarding-link').flush(link);
    await settle();
    // The QR is generated asynchronously.
    await settle(50);

    const poster = (fixture.nativeElement as HTMLElement).querySelector('.nn-print-poster');
    expect(poster).not.toBeNull();
    expect(poster?.textContent).toContain('Kayal House');
    expect(poster?.textContent).toContain('Scan to join');
    expect(poster?.querySelector('svg')).not.toBeNull();
    // Nothing else on the poster: no link, no buttons, no navigation.
    expect(poster?.querySelector('a, button, nav')).toBeNull();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(link.url);
  });

  it('tells staff to ask an owner or manager, without loading the link', async () => {
    const { fixture, http } = await render('STAFF');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Ask an owner or manager');
    http.expectNone('/api/v1/hostels');
  });
});
