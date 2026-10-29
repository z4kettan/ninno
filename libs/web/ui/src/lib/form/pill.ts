import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type PillTone = 'positive' | 'negative' | 'warning' | 'neutral' | 'accent';

const TONES: Record<PillTone, string> = {
  positive: 'bg-[var(--pill-positive-bg)] text-[var(--pill-positive-ink)]',
  negative: 'bg-[var(--pill-negative-bg)] text-[var(--pill-negative-ink)]',
  warning: 'bg-[var(--pill-warning-bg)] text-[var(--pill-warning-ink)]',
  neutral: 'bg-[var(--pill-neutral-bg)] text-[var(--pill-neutral-ink)]',
  accent: 'bg-accent-soft text-accent-ink',
};

/** A pale status label: the tint does the work, the ink carries the word. */
@Component({
  selector: 'nn-pill',
  template: `<ng-content />`,
  host: {
    '[class]': 'classes()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NnPill {
  readonly tone = input<PillTone>('neutral');
  protected readonly classes = computed(
    () =>
      `inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-medium ${TONES[this.tone()]}`,
  );
}
