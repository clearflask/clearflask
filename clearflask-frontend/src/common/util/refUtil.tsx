// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import React, { forwardRef } from 'react';

export interface MutableRef<T> {
  current: T | undefined;
}

export function createMutableRef<T>(initialValue: T | undefined = undefined): MutableRef<T> {
  return { current: initialValue };
}

// https://stackoverflow.com/a/53875195
export const withForwardedRef = Comp => {
  const handle = (props, ref) => (
    <Comp {...props} forwardedRef={ref} />
  );
  const name = Comp.displayName || Comp.name;
  handle.displayName = `withForwardedRef(${name})`;

  return forwardRef(handle);
}
