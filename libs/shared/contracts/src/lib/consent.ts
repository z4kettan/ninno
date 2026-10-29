/**
 * The consent text a resident accepts on the join form's last step.
 *
 * DRAFT for owner review before the pilot (see openspec add-qr-onboarding).
 * Never edit a published version in place: add CONSENT_V2 and point
 * CURRENT_CONSENT at it, so each application keeps the text it accepted.
 */
export interface ConsentText {
  version: string;
  title: string;
  /** Plain-language paragraphs; `{hostel}` is replaced with the hostel's name. */
  paragraphs: string[];
  checkboxLabel: string;
}

export const CONSENT_V1: ConsentText = {
  version: 'v1',
  title: 'How {hostel} uses your details',
  paragraphs: [
    'Why we ask: {hostel} needs your details, photo and ID to confirm who is staying, to keep residents safe, to manage your room and rent, and to contact someone in an emergency. Hostels may also have to share resident details with the police when the law requires it.',
    'Who can see it: only the owner, managers and staff of {hostel}. Ninno stores your details securely for the hostel and does not sell or share them for advertising. Your ID number is never stored in full, only its last 4 characters.',
    'How long it is kept: while you stay at {hostel}, and for up to 1 year after you move out, unless the law requires longer. Applications that are not approved are kept so the hostel can review them if you apply again.',
    'Your choices: you can ask {hostel} to show, correct or delete your details at any time. Some details may have to be kept where the law requires it.',
  ],
  checkboxLabel: 'I have read this and agree to {hostel} using my details as described.',
};

export const CURRENT_CONSENT = CONSENT_V1;

/** Fills in the hostel's name: renderConsent(CONSENT_V1, 'Kayal House'). */
export function renderConsent(text: ConsentText, hostelName: string): ConsentText {
  const fill = (s: string) => s.replaceAll('{hostel}', hostelName);
  return {
    ...text,
    title: fill(text.title),
    paragraphs: text.paragraphs.map(fill),
    checkboxLabel: fill(text.checkboxLabel),
  };
}
