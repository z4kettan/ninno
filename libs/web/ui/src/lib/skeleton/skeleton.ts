import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** A flat grey bar at the real size of the value it stands in for. No shimmer. */
@Component({
  selector: 'nn-skeleton',
  template: ``,
  host: {
    class: 'block rounded-[4px] bg-raised',
    'aria-hidden': 'true',
    '[style.width]': 'width()',
    '[style.height]': 'height()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NnSkeleton {
  readonly width = input('100%');
  readonly height = input('16px');
}
