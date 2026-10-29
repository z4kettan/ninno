import { DialogRef } from '@angular/cdk/dialog';
import { Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SheetService } from './sheet';

@Component({
  template: `<p>Menu</p>
    <button type="button" (click)="ref.close('picked')">Pick</button>`,
})
class MenuSheet {
  readonly ref = inject(DialogRef);
}

@Component({ template: `<button type="button" id="opener">Open</button>` })
class Page {}

describe('SheetService', () => {
  afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((el) => el.remove()));

  it('opens as a labelled dialog and returns focus to the opener on close', async () => {
    const fixture = TestBed.createComponent(Page);
    await fixture.whenStable();
    document.body.appendChild(fixture.nativeElement);
    const opener = fixture.nativeElement.querySelector('#opener') as HTMLButtonElement;
    opener.focus();

    const ref = TestBed.inject(SheetService).open<string>(MenuSheet, { label: 'More' });
    await fixture.whenStable();

    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog).not.toBeNull();
    expect(dialog.getAttribute('aria-label')).toBe('More');
    expect(document.querySelector('.nn-sheet-panel')).not.toBeNull();

    const closed = new Promise((resolve) => ref.closed.subscribe(resolve));
    (dialog.querySelector('button') as HTMLButtonElement).click();
    await expect(closed).resolves.toBe('picked');
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    expect(document.activeElement).toBe(opener);
  });
});
