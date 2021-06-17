import React from "react";

// Based on React

// https://github.com/facebook/react/blob/master/packages/shared/objectIs.js
function is(x: any, y: any) {
  return (
    (x === y && (x !== 0 || 1 / x === 1 / y)) || (x !== x && y !== y) // eslint-disable-line no-self-compare
  );
}

// https://github.com/facebook/react/blob/master/packages/shared/hasOwnProperty.js
const hasOwnProperty = Object.prototype.hasOwnProperty;

function compare(objA: {}, objB: {}, conf?: customShouldComponentUpdateProps): boolean {
  if (is(objA, objB)) {
    return true;
  }

  return compareObjectKeys(objA, objB, conf);
}
// https://github.com/facebook/react/blob/master/packages/shared/shallowEqual.js
function compareObjectKeys(objA, objB, conf?: customShouldComponentUpdateProps): boolean {
  if (
    typeof objA !== 'object' ||
    typeof objB !== 'object' ||
    (objA === null !== objB === null)
  ) {
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

    if (conf?.nested?.has(key) && !compareObjectKeys(valA, valB)) {
      return false;
    } else if (!is(valA, valB)) {
      return false;
    }
  }

  return true;
}

interface customShouldComponentUpdateProps {
  nested?: Set<string>
  ignored?: Set<string>
}
export const customShouldComponentUpdate = <P, S>(confProps?: customShouldComponentUpdateProps, confState?: customShouldComponentUpdateProps) =>
  function (this: React.Component<P, S>, nextProps: P, nextState: S): boolean {
    return compare(this.props, nextProps, confProps)
      && compare(this.state, nextState, confState);
  };