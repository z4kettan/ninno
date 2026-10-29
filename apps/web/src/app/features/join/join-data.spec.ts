import { FormControl, FormGroup } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { compressImage, type DecodedImage, type ImageCodec } from './compress-image';
import { JoinDraftStore, storageKey } from './join-draft.store';
import {
  dateOfBirth,
  idNumberForType,
  indianMobile,
  institutionRequired,
  notSameNumber,
  pincode,
} from './join-validators';
import { lookupPincode } from './pincode';

/** An in-memory Storage. */
class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  clear() {
    this.data.clear();
  }
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  key(i: number) {
    return [...this.data.keys()][i] ?? null;
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}

const control = (value: string) => new FormControl(value);

describe('join validators', () => {
  it('accepts Indian mobiles and leaves empty optional fields alone', () => {
    expect(indianMobile(control('98765 43210'))).toBeNull();
    expect(indianMobile(control(''))).toBeNull();
    expect(indianMobile(control('12345'))).toEqual({ indianMobile: true });
  });

  it('checks pincodes', () => {
    expect(pincode(control('682030'))).toBeNull();
    expect(pincode(control('012345'))).toEqual({ pincode: true });
    expect(pincode(control('68203'))).toEqual({ pincode: true });
  });

  it('requires residents to be at least 16, by the IST calendar', () => {
    // 10 March 2026, 8 pm UTC = 11 March in India.
    const dob = dateOfBirth(() => new Date('2026-03-10T20:00:00Z'));
    expect(dob(control('2010-03-11'))).toBeNull();
    expect(dob(control('2010-03-12'))).toEqual({ tooYoung: true });
    expect(dob(control('2027-01-01'))).toEqual({ future: true });
    expect(dob(control('2004-02-30'))).toEqual({ date: true });
  });

  it('checks the ID number against its type', () => {
    const group = (type: string, idNumber: string) =>
      new FormGroup({ type: control(type), idNumber: control(idNumber) });
    expect(idNumberForType(group('AADHAAR', '2341 2341 2346'))).toBeNull();
    expect(idNumberForType(group('AADHAAR', '2341 2341 2347'))).toEqual({ idNumber: true });
    expect(idNumberForType(group('PAN', 'ABCDE1234F'))).toBeNull();
    expect(idNumberForType(group('', '123'))).toBeNull();
  });

  it('asks students and working residents for their institution or company', () => {
    const group = (occupationType: string, institutionOrCompany: string) =>
      new FormGroup({
        occupationType: control(occupationType),
        institutionOrCompany: control(institutionOrCompany),
      });
    expect(institutionRequired(group('STUDENT', ' '))).toEqual({ institutionRequired: true });
    expect(institutionRequired(group('WORKING', 'Infopark'))).toBeNull();
    expect(institutionRequired(group('OTHER', ''))).toBeNull();
  });

  it("wants someone else's number for the emergency contact", () => {
    const check = notSameNumber(() => '9876543210');
    expect(check(control('+91 98765 43210'))).toEqual({ sameNumber: true });
    expect(check(control('9447000001'))).toBeNull();
  });
});

describe('JoinDraftStore', () => {
  const create = () => TestBed.runInInjectionContext(() => new JoinDraftStore());

  it('keeps typed text on the device and brings it back after the tab closes', () => {
    const storage = new MemoryStorage();
    const first = create();
    first.open('tok', storage);
    first.contact.patchValue({ phone: '9876543210', city: 'Kochi' });
    first.setStep(2);

    const again = create();
    again.open('tok', storage);
    expect(again.step()).toBe(2);
    expect(again.contact.controls.city.value).toBe('Kochi');
    expect(again.contact.controls.phone.value).toBe('9876543210');
  });

  it('never writes the ID number to the device', () => {
    const storage = new MemoryStorage();
    const store = create();
    store.open('tok', storage);
    store.id.patchValue({ type: 'AADHAAR', idNumber: '234123412346' });
    const saved = storage.getItem(storageKey('tok')) ?? '';
    expect(saved).toContain('AADHAAR');
    expect(saved).not.toContain('234123412346');
  });

  it('stores only storage keys for files', () => {
    const storage = new MemoryStorage();
    const store = create();
    store.open('tok', storage);
    store.setDraft({ draftId: 'd1', draftToken: 't', expiresAt: '2999-01-01T00:00:00Z' });
    store.setFile('selfie', {
      key: 'pending/d1/selfie-x.jpg',
      contentType: 'image/jpeg',
      name: 'me.jpg',
    });
    const saved = JSON.parse(storage.getItem(storageKey('tok')) ?? '{}');
    expect(saved.files).toEqual({
      selfie: { key: 'pending/d1/selfie-x.jpg', contentType: 'image/jpeg', name: 'me.jpg' },
    });
  });

  it("forgets an expired draft's token and uploads but keeps the text", () => {
    const storage = new MemoryStorage();
    const store = create();
    store.open('tok', storage);
    store.about.patchValue({ fullName: 'Anjali' });
    store.setDraft({ draftId: 'd1', draftToken: 't', expiresAt: '2026-03-10T00:00:00Z' });
    store.setFile('selfie', { key: 'k', contentType: 'image/jpeg', name: 'me.jpg' });

    const later = create();
    later.open('tok', storage, new Date('2026-03-11T00:00:00Z'));
    expect(later.draft()).toBeNull();
    expect(later.files()).toEqual({});
    expect(later.about.controls.fullName.value).toBe('Anjali');
  });

  it('removes everything from the device when cleared', () => {
    const storage = new MemoryStorage();
    const store = create();
    store.open('tok', storage);
    store.about.patchValue({ fullName: 'Anjali' });
    store.clear();
    expect(storage.getItem(storageKey('tok'))).toBeNull();
  });

  it('requires the back photo only for ID types that have one', () => {
    const store = create();
    store.open('tok', new MemoryStorage());
    store.id.patchValue({ type: 'AADHAAR', idNumber: '234123412346' });
    store.setFile('id-front', { key: 'f', contentType: 'image/jpeg', name: 'f.jpg' });
    expect(store.stepValid('id')).toBe(false);
    store.setFile('id-back', { key: 'b', contentType: 'image/jpeg', name: 'b.jpg' });
    expect(store.stepValid('id')).toBe(true);

    store.id.patchValue({ type: 'PAN', idNumber: 'ABCDE1234F' });
    store.setFile('id-back', null);
    expect(store.stepValid('id')).toBe(true);
    expect(store.fileKeys().idBackKey).toBeNull();
  });

  it('cannot finish the review without consent', () => {
    const store = create();
    store.open('tok', new MemoryStorage());
    expect(store.stepValid('review')).toBe(false);
    store.consent.setValue(true);
    expect(store.stepValid('review')).toBe(true);
  });

  it('builds the API form with trimmed text and empty optionals as null', () => {
    const store = create();
    store.open('tok', new MemoryStorage());
    store.about.patchValue({ fullName: '  Anjali Menon ', dob: '2004-08-24', gender: 'FEMALE' });
    store.contact.patchValue({ phone: '9876543210', altPhone: ' ', line2: '' });
    const form = store.form();
    expect(form.fullName).toBe('Anjali Menon');
    expect(form.altPhone).toBeNull();
    expect(form.permanentAddress.line2).toBeNull();
    expect(form.consentVersion).toBe('v1');
  });
});

describe('compressImage', () => {
  /** Pretends JPEG size is proportional to pixels × quality. */
  const fakeCodec = (width: number, height: number, bytesPerPixel = 1) => {
    const calls: { width: number; height: number; quality: number }[] = [];
    const codec: ImageCodec<DecodedImage> = {
      decode: async () => ({ width, height }),
      encode: async (_image, w, h, quality) => {
        calls.push({ width: w, height: h, quality });
        return new Blob([new Uint8Array(Math.round(w * h * quality * bytesPerPixel))]);
      },
    };
    return { codec, calls };
  };

  it('caps the long side at 2560px', async () => {
    const { codec, calls } = fakeCodec(4000, 3000, 0.05);
    await compressImage(new Blob(), codec);
    expect(calls[0]).toMatchObject({ width: 2560, height: 1920 });
  });

  it('steps quality down, then size, until it is under 1 MB', async () => {
    const { codec, calls } = fakeCodec(2000, 1500, 0.8);
    const blob = await compressImage(new Blob(), codec);
    expect(blob.size).toBeLessThanOrEqual(1024 * 1024);
    expect(calls.map((c) => c.quality).slice(0, 4)).toEqual([0.85, 0.75, 0.65, 0.55]);
    expect(calls.at(-1)?.width).toBeLessThan(2000);
  });

  it('keeps a small photo at full size and top quality', async () => {
    const { codec, calls } = fakeCodec(800, 600, 0.5);
    await compressImage(new Blob(), codec);
    expect(calls).toEqual([{ width: 800, height: 600, quality: 0.85 }]);
  });
});

describe('lookupPincode', () => {
  const answer = (body: unknown, ok = true) =>
    (async () => ({ ok, json: async () => body })) as unknown as typeof fetch;

  it('fills city and state from India Post', async () => {
    const place = await lookupPincode(
      '682030',
      answer([{ Status: 'Success', PostOffice: [{ District: 'Ernakulam', State: 'Kerala' }] }]),
    );
    expect(place).toEqual({ city: 'Ernakulam', state: 'Kerala' });
  });

  it('falls back to typing when the service fails, is slow or does not know the code', async () => {
    expect(
      await lookupPincode('682030', answer([{ Status: 'Error', PostOffice: null }])),
    ).toBeNull();
    expect(await lookupPincode('682030', answer({}, false))).toBeNull();
    const offline = (async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    expect(await lookupPincode('682030', offline)).toBeNull();
    const timedOut = (async () => {
      throw new DOMException('timed out', 'TimeoutError');
    }) as unknown as typeof fetch;
    expect(await lookupPincode('682030', timedOut)).toBeNull();
  });

  it('sends nothing for an invalid pincode', async () => {
    let called = false;
    const spy = (async () => {
      called = true;
      return { ok: true, json: async () => [] };
    }) as unknown as typeof fetch;
    expect(await lookupPincode('12', spy)).toBeNull();
    expect(called).toBe(false);
  });
});
