import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NnOtpInput } from './otp-input';

@Component({
  imports: [NnOtpInput],
  template: `<nn-otp-input [(value)]="code" (completed)="completed.push($event)" />`,
})
class Host {
  code = signal('');
  completed: string[] = [];
}

async function render() {
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
  const type = async (value: string) => {
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  };
  const boxes = () =>
    Array.from(fixture.nativeElement.querySelectorAll('[aria-hidden="true"] > span')).map((el) =>
      (el as HTMLElement).textContent?.trim(),
    );
  return { fixture, input, type, boxes, host: fixture.componentInstance };
}

describe('NnOtpInput', () => {
  it('is one real input with SMS autofill and a numeric keypad', async () => {
    const { input } = await render();
    expect(input.getAttribute('autocomplete')).toBe('one-time-code');
    expect(input.getAttribute('inputmode')).toBe('numeric');
    expect(input.getAttribute('maxlength')).toBe('6');
    expect(input.labels?.[0]?.textContent).toBe('6-digit code');
  });

  it('shows typed digits in the boxes and emits once complete', async () => {
    const { type, boxes, host } = await render();
    await type('482');
    expect(boxes()).toEqual(['4', '8', '2', '', '', '']);
    expect(host.completed).toEqual([]);
    await type('482913');
    expect(host.code()).toBe('482913');
    expect(host.completed).toEqual(['482913']);
  });

  it('accepts a pasted code with spaces or text around it', async () => {
    const { type, host } = await render();
    await type('Your Ninno code is 482 913');
    expect(host.code()).toBe('482913');
    expect(host.completed).toEqual(['482913']);
  });

  it('removes the last digit on backspace', async () => {
    const { type, boxes } = await render();
    await type('4829');
    await type('482');
    expect(boxes()).toEqual(['4', '8', '2', '', '', '']);
  });

  it('never keeps more than six digits', async () => {
    const { type, host } = await render();
    await type('48291377');
    expect(host.code()).toBe('482913');
  });
});
