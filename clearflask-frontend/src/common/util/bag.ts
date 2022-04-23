// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
export interface BagReader<T> {
  get(): T | undefined;
}

export interface BagWriter<T> {
  set(value: T | undefined): void;
}

export class Bag<T> implements BagReader<T>, BagWriter<T> {
  value?: T = undefined;

  constructor(defaultValue: T | undefined = undefined) {
    this.set(defaultValue);
  }

  get(): T | undefined {
    return this.value;
  }

  set(value: T | undefined): void {
    this.value = value;
  }
}
