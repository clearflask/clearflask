import React, { useEffect, useRef } from "react";

/** https://stackoverflow.com/a/51082563 */

// Usage within class:
// componentDidUpdate = traceRenderComponentDidUpdate;
export function traceRenderComponentDidUpdate(this: React.Component, prevProps, prevState) {
  diff(prevProps, this.props, 'DEBUG: Props changed:');
  diff(prevState, this.state, 'DEBUG: State changed:');
}

// Usage within function component:
// useTraceRender(props);
export const useTraceRender = (props, uniqId?: string) => {
  const prev = useRef(props);
  useEffect(() => {
    diff(prev.current, props, `DEBUG: ${uniqId ? uniqId + ': ' : ''}Props changed:`);
    prev.current = props;
  });
}

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
