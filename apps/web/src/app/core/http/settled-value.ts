import { computed, type Resource, type Signal } from '@angular/core';

/**
 * A resource's value, or undefined while it loads or after it failed. Reading
 * `resource.value()` directly throws in the error state, which would break the whole view
 * (and anything computed from it) instead of letting it show its error message.
 */
export function settledValue<T>(resource: Resource<T>): Signal<T | undefined> {
  return computed(() => (resource.hasValue() ? resource.value() : undefined));
}
