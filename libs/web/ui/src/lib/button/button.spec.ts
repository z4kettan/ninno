import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NnMark } from '../mark/mark';
import { NnButton } from './button';

@Component({
  imports: [NnButton, NnMark],
  template: `
    <button nnButton [loading]="loading()" [disabled]="disabled()" (click)="clicks = clicks + 1">
      Send code
    </button>
    <nn-mark [wordmark]="true" />
  `,
})
class Host {
  loading = signal(false);
  disabled = signal(false);
  clicks = 0;
}

async function render() {
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
  return { fixture, button, host: fixture.componentInstance };
}

describe('NnButton', () => {
  it('uses the label as its accessible name and the hue for the primary style', async () => {
    const { button } = await render();
    expect(button.textContent?.trim()).toBe('Send code');
    expect(button.className).toContain('bg-accent');
    expect(button.className).toContain('min-h-11');
  });

  it('marks itself busy while loading and ignores clicks', async () => {
    const { fixture, button, host } = await render();
    host.loading.set(true);
    await fixture.whenStable();
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.className).toContain('pointer-events-none');
    expect(button.querySelector('span.animate-spin')).not.toBeNull();
  });

  it('does not fire clicks when disabled', async () => {
    const { fixture, button, host } = await render();
    host.disabled.set(true);
    await fixture.whenStable();
    button.click();
    expect(host.clicks).toBe(0);
  });

  it('exposes the mark to assistive tech as "Ninno"', async () => {
    const { fixture } = await render();
    const mark = fixture.nativeElement.querySelector('nn-mark') as HTMLElement;
    expect(mark.getAttribute('role')).toBe('img');
    expect(mark.getAttribute('aria-label')).toBe('Ninno');
  });
});
