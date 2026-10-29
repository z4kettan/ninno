import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** "Step 2 of 6 · Contact" over a thin track: the tint carries the track, the hue the fill. */
@Component({
  selector: 'nn-step-progress',
  template: `
    <p class="text-sm text-muted num">
      <span i18n>Step {{ step() }} of {{ total() }}</span> · {{ label() }}
    </p>
    <div
      class="mt-2 h-1 overflow-hidden rounded-full bg-accent-track"
      role="progressbar"
      [attr.aria-valuemin]="1"
      [attr.aria-valuemax]="total()"
      [attr.aria-valuenow]="step()"
      [attr.aria-label]="label()"
    >
      <div
        class="h-full rounded-full bg-accent transition-[width] duration-200 ease-[var(--ease)]"
        [style.width.%]="percent()"
      ></div>
    </div>
  `,
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NnStepProgress {
  readonly step = input.required<number>();
  readonly total = input.required<number>();
  readonly label = input.required<string>();

  protected readonly percent = computed(() => Math.round((this.step() / this.total()) * 100));
}
