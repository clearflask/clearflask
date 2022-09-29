// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
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

export type WithMediaQueries<Queries extends string> = {
  mediaQueries: { [name in Queries]: boolean };
};

export const withMediaQueries = <Queries extends string, Props>(
  queriesMapper: (props: Props) => Record<Queries, (string | ((theme: Theme) => string))>,
  options?: Options,
) => Component => props => {
  const mediaQueries = {};
  const queries = queriesMapper(props);
  Object.keys(queries).forEach(query => {
    mediaQueries[query] = useMediaQuery(queries[query], options)
  });
  return <Component {...props} mediaQueries={mediaQueries} />;
};
