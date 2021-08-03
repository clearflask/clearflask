// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import React, { useEffect, useRef } from "react";

// Based on React

// https://github.com/facebook/react/blob/master/packages/shared/objectIs.js
/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This function is licensed under the MIT license.
 */
function is(x: any, y: any) {
  return (
    (x === y && (x !== 0 || 1 / x === 1 / y)) || (x !== x && y !== y) // eslint-disable-line no-self-compare
  );
}

// https://github.com/facebook/react/blob/master/packages/shared/hasOwnProperty.js
/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This function is licensed under the MIT license.
 */
const hasOwnProperty = Object.prototype.hasOwnProperty;

function equal(objA: {}, objB: {}, conf?: customShouldComponentUpdateProps): boolean {
  if (is(objA, objB)) {
    return true;
  }

  return equalObjectKeys(objA, objB, conf);
}
// https://github.com/facebook/react/blob/master/packages/shared/shallowEqual.js
/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This function is licensed under the MIT license.
 */
function equalObjectKeys(objA, objB, conf?: customShouldComponentUpdateProps): boolean {
  if (!objA !== !objB) return false;
  if (!objA && !objB) return true;

  if (Array.isArray(objA) && Array.isArray(objB)) {
    if (objA.length !== objB.length) return false;
    for (let i = 0; i < objA.length; i++) {
      if (!is(objA[i], objB[i])) return false;
    }
    return true;
  }

  if (typeof objA !== 'object' || typeof objB !== 'object') {
    return false;
  }

  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);

  if (keysA.length !== keysB.length) {
    return false;
  }

  for (let i = 0; i < keysA.length; i++) {
    const key = keysA[i];

    if (conf?.ignored?.has(key)) continue;

    const valA = objA[key];
    const valB = objB[key];

    if (!hasOwnProperty.call(objB, key)) return false;

    if (conf?.nested?.has(key)) {
      if (!equalObjectKeys(valA, valB)) {
        return false;
      }
    } else if (conf?.presence?.has(key)) {
      if ((valA === undefined) !== (valB === undefined)) {
        return false;
      }
    } else if (!is(valA, valB)) {
      return false;
    }
  }

  return true;
}

interface customShouldComponentUpdateProps {
  // For objects and arrays only, do not rerender on change in reference,
  // but shallow equal all key value pairs or items in array.
  nested?: Set<string>
  // Rerender if the value changes between undefined and defined
  presence?: Set<string>
  // Do not rerender based on these properties
  ignored?: Set<string>
}
/**
 * Fine-grained control over when components should update.
 * Example:
 * 
 * shouldComponentUpdate = customShouldComponentUpdate({
 *   nested: new Set(['display']),
 * });
 */
export const customShouldComponentUpdate = <P extends {}, S extends {}>(confProps?: customShouldComponentUpdateProps, confState?: customShouldComponentUpdateProps) =>
  function (this: React.Component<P, S>, nextProps: P, nextState: S): boolean {
    return !equal(this.state, nextState, confState)
      || !equal(this.props, nextProps, confProps);
  };


/**
 * Fine-grained control over when functional components should update.
 * Example:
 * 
 * const Cmpt = React.memo((...) => {
 *   ...
 * }, customReactMemoEquals({
 *   nested: new Set(['PostListProps', 'DroppableProvidedProps']),
 * }));
 */
export const customReactMemoEquals = <P extends {}>(confProps?: customShouldComponentUpdateProps) =>
  function (prevProps: Readonly<React.PropsWithChildren<P>>, nextProps: Readonly<React.PropsWithChildren<P>>): boolean {
    return equal(prevProps, nextProps, confProps);
  };


/**
 * Show changed props/state when a component renders.
 * Example:
 * 
 * componentDidUpdate = traceRenderComponentDidUpdate;
 */
export function traceRenderComponentDidUpdate(this: React.Component, prevProps, prevState) {
  diff(prevProps, this.props, 'DEBUG: Props changed:');
  diff(prevState, this.state, 'DEBUG: State changed:');
}

/**
 * Show changed props when a functional component renders.
 * Example:
 * 
 * useTraceRender(props);
 */
export const useTraceRender = (props, uniqId?: string) => {
  const prev = useRef(props);
  useEffect(() => {
    diff(prev.current, props, `DEBUG: ${uniqId ? uniqId + ': ' : ''}Props changed:`);
    prev.current = props;
  });
}

// https://stackoverflow.com/a/51082563
const diff = (prev: object, curr: object, msg: string) => {
  const changedProps = Object.entries(curr || {}).reduce((ps, [k, v]) => {
    if (prev?.[k] !== v) {
      ps[k] = [prev?.[k], v];
    }
    return ps;
  }, {});
  if (Object.keys(changedProps).length > 0) {
    console.log(msg, changedProps);
  }
}
