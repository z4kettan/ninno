import { CONSENT_V1, CURRENT_CONSENT, renderConsent } from './consent';

describe('consent text', () => {
  it('fills in the hostel name everywhere', () => {
    const text = renderConsent(CONSENT_V1, 'Kayal House');
    const all = [text.title, ...text.paragraphs, text.checkboxLabel].join(' ');
    expect(all).not.toContain('{hostel}');
    expect(text.title).toBe('How Kayal House uses your details');
  });

  it('covers why, who, how long and deletion', () => {
    const all = CONSENT_V1.paragraphs.join(' ');
    expect(all).toMatch(/Why we ask/);
    expect(all).toMatch(/Who can see it/);
    expect(all).toMatch(/How long it is kept/);
    expect(all).toMatch(/delete/);
  });

  it('is versioned', () => {
    expect(CURRENT_CONSENT.version).toBe('v1');
  });
});
