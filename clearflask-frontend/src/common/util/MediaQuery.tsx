import { Options, Theme, useMediaQuery } from '@material-ui/core';
import React from 'react';

export type WithMediaQuery = {
  mediaQuery: boolean;
};

export const withMediaQuery = (
  query: string | ((theme: Theme) => string),
  options?: Options,
) => Component => props => {
  const mediaQuery = useMediaQuery(query, options);
  return <Component {...props} mediaQuery={mediaQuery} />;
};

export type WithMediaQueries = {
  mediaQueries: { [name: string]: boolean };
};

/** Untested */
export const withMediaQueries = (
  queries: { [name: string]: (string | ((theme: Theme) => string)) },
  options?: Options,
) => Component => props => {
  const mediaQueries = {};
  Object.keys(queries).forEach(name => mediaQueries[name] = useMediaQuery(queries[name], options));
  return <Component {...props} mediaQueries={mediaQueries} />;
};
