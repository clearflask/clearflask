
export interface MutableRef<T> {
  current: T | undefined;
}

export function createMutableRef<T>(initialValue: T | undefined = undefined): MutableRef<T> {
  return { current: initialValue };
}
