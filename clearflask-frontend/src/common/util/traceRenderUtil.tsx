import React, { useEffect, useRef } from "react";

/** https://stackoverflow.com/a/51082563 */

// Usage within class:
// componentDidUpdate = traceRenderComponentDidUpdate;
export function traceRenderComponentDidUpdate(this: React.Component, prevProps, prevState) {
  Object.entries(this.props).forEach(([key, val]) =>
    prevProps[key] !== val && console.log(`Changed prop: '${key}'`)
  );
  if (this.state) {
    Object.entries(this.state).forEach(([key, val]) =>
      prevState[key] !== val && console.log(`Changed State: '${key}'`)
    );
  }
}

// Usage within function component:
// useTraceRender(props);
export const useTraceRender = (props, uniqId?: string) => {
  const prev = useRef(props);
  useEffect(() => {
    const changedProps = Object.entries(props).reduce((ps, [k, v]) => {
      if (prev.current[k] !== v) {
        ps[k] = [prev.current[k], v];
      }
      return ps;
    }, {});
    if (Object.keys(changedProps).length > 0) {
      console.log(`${uniqId || ''}: Changed props:`, changedProps);
    }
    prev.current = props;
  });
}
