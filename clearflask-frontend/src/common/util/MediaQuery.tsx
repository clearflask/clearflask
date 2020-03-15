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
