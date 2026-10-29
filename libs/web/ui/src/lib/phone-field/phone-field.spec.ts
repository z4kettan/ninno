import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { cleanDigits, NnPhoneField } from './phone-field';

@Component({
  imports: [NnPhoneField],
  template: `<nn-phone-field [(value)]="phone" [error]="error()" />`,
})
class Host {
  phone = signal('');
  error = signal<string | null>(null);
}

describe('cleanDigits', () => {
  it.each([
    ['98765 43210', '9876543210'],
    ['+91 98765-43210', '9876543210'],
    ['919876543210', '9876543210'],
    ['09876543210', '9876543210'],
    ['98765432109999', '9876543210'],
  ])('%s → %s', (raw, digits) => {
    expect(cleanDigits(raw)).toBe(digits);
  });
});

describe('NnPhoneField', () => {
  it('keeps digits in the model and shows them grouped', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = '+91 9876543210';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(fixture.componentInstance.phone()).toBe('9876543210');
    expect(input.value).toBe('98765 43210');
    expect(input.labels?.[0]?.textContent).toBe('Mobile number');
    expect(input.getAttribute('inputmode')).toBe('numeric');
  });

  it('links the error to the input for screen readers', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.error.set('Enter a 10-digit mobile number');
    await fixture.whenStable();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    const describedBy = input.getAttribute('aria-describedby');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(fixture.nativeElement.querySelector(`#${describedBy}`)?.textContent).toContain(
      '10-digit',
    );
  });
});
