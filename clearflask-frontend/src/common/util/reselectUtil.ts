// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { createSelectorCreator, defaultMemoize } from 'reselect';


const arrayContentEquality = <T extends Array<any>>(a: T, b: T) => {
  if (a.length !== b.length) return false;
  for (var i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};
const objectContentEquality = <T extends object>(a: T, b: T) => {
  const aKeys = Object.keys(a);
  if (aKeys.length !== Object.keys(b).length) return false;
  for (const key of aKeys) {
    const aKey = a[key];
    if (aKey !== b[key]) return false;
    // Cover case where key is present but is undefined
    if (aKey === undefined && !(key in b)) return false;
  }
  return true;
};

const contentEquality = <T>(a: T, b: T) => {
  if (a === b) {
    return true;
  } else if (a === undefined || b === undefined) {
    return false;
  } else if (Array.isArray(a)) {
    return arrayContentEquality(a as any, b as any);
  } else if (typeof a === 'object') {
    return objectContentEquality(a as any, b as any);
  } else {
    return false;
  }
};

const createContentSelector =
  createSelectorCreator(defaultMemoize, contentEquality);

/**
 * Compares arrays/objects by content inside with shallow equal,
 * does not compare references of the array/object itself.
 * All other non-arrays, non-objects are compares using shallow equal.
 * 
 * Useful when creating new arrays such as using Array#filter.
 */
export const selectorContentWrap = <T>(selector: T): T => {
  return createContentSelector(
    selector as any,
    (val) => val,
  ) as any;
}