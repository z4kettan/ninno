import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import {
  CURRENT_CONSENT,
  type Gender,
  type OccupationType,
  ONBOARDING_LIMITS as L,
  type OnboardingFiles,
  type OnboardingForm,
  type UploadKind,
} from '@ninno/contracts';
import { type IdDocumentType, idTypeNeedsBack } from '@ninno/utils';
import { merge } from 'rxjs';
import {
  dateOfBirth,
  idNumberForType,
  indianMobile,
  institutionRequired,
  notSameNumber,
  pincode,
} from './join-validators';

export const JOIN_STEPS = ['about', 'contact', 'work', 'emergency', 'id', 'review'] as const;
export type JoinStep = (typeof JOIN_STEPS)[number];

export interface StoredFile {
  key: string;
  contentType: string;
  name: string;
}

export interface Draft {
  draftId: string;
  draftToken: string;
  expiresAt: string;
}

/** What is kept on the device: text and storage keys, never the files themselves. */
interface Saved {
  v: 1;
  step: number;
  draft: Draft | null;
  values: Record<string, unknown>;
  files: Partial<Record<UploadKind, StoredFile>>;
}

const text = (validators = [Validators.required]) =>
  new FormControl('', { nonNullable: true, validators });

export const storageKey = (token: string) => `ninno.join.${token}`;

/**
 * The join form while it is being filled in: one typed form group per step, the draft
 * token, and the uploaded files' keys. Text is saved to the device as it is typed so a
 * closed tab loses nothing; everything is removed after a successful submission.
 */
@Injectable()
export class JoinDraftStore {
  private token = '';
  private storage: Storage | null = null;

  readonly about = new FormGroup({
    fullName: text([
      Validators.required,
      Validators.minLength(L.nameMin),
      Validators.maxLength(L.nameMax),
    ]),
    dob: text([Validators.required, dateOfBirth()]),
    gender: new FormControl<Gender | ''>('', {
      nonNullable: true,
      validators: Validators.required,
    }),
  });

  readonly contact = new FormGroup({
    phone: text([Validators.required, indianMobile]),
    altPhone: text([indianMobile]),
    email: text([Validators.email, Validators.maxLength(L.emailMax)]),
    line1: text([Validators.required, Validators.maxLength(L.addressLineMax)]),
    line2: text([Validators.maxLength(L.addressLineMax)]),
    city: text([Validators.required, Validators.maxLength(L.textMax)]),
    state: text([Validators.required, Validators.maxLength(L.textMax)]),
    pincode: text([Validators.required, pincode]),
  });

  readonly work = new FormGroup(
    {
      occupationType: new FormControl<OccupationType | ''>('', {
        nonNullable: true,
        validators: Validators.required,
      }),
      institutionOrCompany: text([Validators.maxLength(L.textMax)]),
    },
    { validators: institutionRequired },
  );

  readonly emergency = new FormGroup({
    name: text([
      Validators.required,
      Validators.minLength(L.nameMin),
      Validators.maxLength(L.nameMax),
    ]),
    phone: text([
      Validators.required,
      indianMobile,
      notSameNumber(() => this.contact.controls.phone.value),
    ]),
    relation: text([Validators.required, Validators.maxLength(L.relationMax)]),
  });

  readonly id = new FormGroup(
    {
      type: new FormControl<IdDocumentType | ''>('', {
        nonNullable: true,
        validators: Validators.required,
      }),
      idNumber: text(),
    },
    { validators: idNumberForType },
  );

  readonly consent = new FormControl(false, {
    nonNullable: true,
    validators: Validators.requiredTrue,
  });

  private readonly groups = {
    about: this.about,
    contact: this.contact,
    work: this.work,
    emergency: this.emergency,
    id: this.id,
  };

  /** 0 = the hostel intro, 1–6 = the steps. */
  readonly step = signal(0);
  readonly draft = signal<Draft | null>(null);
  readonly files = signal<Partial<Record<UploadKind, StoredFile>>>({});

  constructor() {
    const sub = merge(
      ...Object.values(this.groups).map((g) => g.valueChanges),
      this.consent.valueChanges,
    ).subscribe(() => this.save());
    inject(DestroyRef, { optional: true })?.onDestroy(() => sub.unsubscribe());
  }

  /** Loads what this device saved for the link, if anything. */
  open(token: string, storage: Storage | null = safeLocalStorage(), now = new Date()): void {
    this.token = token;
    this.storage = storage;
    const raw = this.read();
    if (!raw) {
      return;
    }
    for (const [name, group] of Object.entries(this.groups)) {
      const values = raw.values[name];
      if (values && typeof values === 'object') {
        group.patchValue(values as never, { emitEvent: false });
      }
    }
    // Uploads belong to the draft; an expired draft's files can't be submitted any more.
    const live = raw.draft && new Date(raw.draft.expiresAt) > now ? raw.draft : null;
    this.draft.set(live);
    this.files.set(live ? (raw.files ?? {}) : {});
    this.step.set(Math.min(Math.max(raw.step ?? 0, 0), JOIN_STEPS.length));
  }

  setStep(step: number): void {
    this.step.set(step);
    this.save();
  }

  setDraft(draft: Draft): void {
    this.draft.set(draft);
    this.files.set({});
    this.save();
  }

  /** The draft expired on the server: its token and uploads are useless now. */
  forgetDraft(): void {
    this.draft.set(null);
    this.files.set({});
    this.save();
  }

  setFile(kind: UploadKind, file: StoredFile | null): void {
    this.files.update((files) => {
      const next = { ...files };
      if (file) {
        next[kind] = file;
      } else {
        delete next[kind];
      }
      return next;
    });
    this.save();
  }

  needsBack(): boolean {
    const type = this.id.controls.type.value;
    return type !== '' && idTypeNeedsBack(type);
  }

  /** Whether the step's own fields (and photos) are complete. */
  stepValid(step: JoinStep): boolean {
    const files = this.files();
    switch (step) {
      case 'about':
        return this.about.valid && !!files.selfie;
      case 'id':
        return this.id.valid && !!files['id-front'] && (!this.needsBack() || !!files['id-back']);
      case 'review':
        return this.consent.value;
      default:
        return this.groups[step].valid;
    }
  }

  form(): OnboardingForm {
    const a = this.about.getRawValue();
    const c = this.contact.getRawValue();
    const w = this.work.getRawValue();
    const e = this.emergency.getRawValue();
    const i = this.id.getRawValue();
    return {
      fullName: a.fullName.trim(),
      dob: a.dob,
      gender: a.gender as Gender,
      phone: c.phone,
      altPhone: c.altPhone.trim() || null,
      email: c.email.trim() || null,
      permanentAddress: {
        line1: c.line1.trim(),
        line2: c.line2.trim() || null,
        city: c.city.trim(),
        state: c.state.trim(),
        pincode: c.pincode.trim(),
      },
      occupationType: w.occupationType as OccupationType,
      institutionOrCompany: w.institutionOrCompany.trim() || null,
      emergencyContact: { name: e.name.trim(), phone: e.phone, relation: e.relation.trim() },
      idDocument: { type: i.type as IdDocumentType, idNumber: i.idNumber },
      consentVersion: CURRENT_CONSENT.version,
    };
  }

  fileKeys(): OnboardingFiles {
    const files = this.files();
    return {
      selfieKey: files.selfie?.key ?? '',
      idFrontKey: files['id-front']?.key ?? '',
      idBackKey: this.needsBack() ? (files['id-back']?.key ?? null) : null,
    };
  }

  /** Removes every trace of the draft from the device. */
  clear(): void {
    try {
      this.storage?.removeItem(storageKey(this.token));
    } catch {
      // Storage can be unavailable (private mode); nothing was saved then.
    }
  }

  private save(): void {
    if (!this.storage || !this.token) {
      return;
    }
    const values: Record<string, unknown> = Object.fromEntries(
      Object.entries(this.groups).map(([name, group]) => [name, group.getRawValue()]),
    );
    // The ID number is never written to the device: a shared phone must not keep an
    // Aadhaar number. After a reload the resident types it again.
    values['id'] = { type: this.id.controls.type.value };
    const saved: Saved = {
      v: 1,
      step: this.step(),
      draft: this.draft(),
      values,
      files: this.files(),
    };
    try {
      this.storage.setItem(storageKey(this.token), JSON.stringify(saved));
    } catch {
      // Full or blocked storage: the form still works, it just won't survive a reload.
    }
  }

  private read(): Saved | null {
    try {
      const raw = this.storage?.getItem(storageKey(this.token));
      const parsed = raw ? (JSON.parse(raw) as Saved) : null;
      return parsed?.v === 1 ? parsed : null;
    } catch {
      return null;
    }
  }
}

function safeLocalStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}
