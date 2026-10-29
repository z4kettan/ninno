import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type ButtonVariant = 'primary' | 'secondary' | 'text';

const BASE =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-control px-4 text-base font-semibold ' +
  'transition-[background-color,transform] duration-[var(--fast)] ease-[var(--ease)] ' +
  'active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100 select-none';

const VARIANTS: Record<ButtonVariant, string> = {
  // The one filled style: the hue at full strength, a small mark by area.
  primary: 'bg-accent text-on-accent hover:brightness-95 disabled:opacity-60',
  secondary:
    'border border-control bg-surface text-text hover:bg-raised disabled:text-muted disabled:hover:bg-surface',
  text: 'px-2 text-accent-ink hover:bg-accent-soft disabled:text-muted disabled:hover:bg-transparent',
};

/**
 * `<button nnButton>` / `<a nnButton>`. While `loading`, the button is disabled for clicks,
 * keeps its width and tells screen readers it is busy.
 */
@Component({
  // An attribute selector keeps the host a native <button>/<a>: keyboard, form submit and
  // accessibility come from the platform instead of being re-implemented.
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'button[nnButton], a[nnButton]',
  template: `
    @if (loading()) {
      <span
        class="size-4 animate-spin rounded-full border-2 border-current border-r-transparent"
        aria-hidden="true"
      ></span>
    }
    <ng-content />
  `,
  host: {
    '[class]': 'classes()',
    '[attr.aria-busy]': 'loading() || null',
    '[attr.aria-disabled]': 'loading() || null',
    '[class.pointer-events-none]': 'loading()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NnButton {
  readonly variant = input<ButtonVariant>('primary');
  readonly loading = input(false);
  readonly block = input(false);

  protected readonly classes = computed(
    () => `${BASE} ${VARIANTS[this.variant()]} ${this.block() ? 'w-full' : ''}`,
  );
}
