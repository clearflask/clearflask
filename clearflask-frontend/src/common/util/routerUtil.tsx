import React from 'react';
import { Redirect, Route, StaticRouterContext } from "react-router";
import windowIso from '../windowIso';

// https://reactrouter.com/web/guides/server-rendering/404-401-or-any-other-status
export function RouteWithStatus(props: { httpCode: number, children }) {
  return (
    <Route
      render={({ staticContext }) => {
        if (staticContext) staticContext.statusCode = props.httpCode;
        return props.children;
      }}
    />
  );
}

export function RedirectIso(props: { to: string, httpCode?: number }) {
  return (
    <Route
      render={({ staticContext }) => {
        if (windowIso.isSsr && staticContext) {
          (staticContext as StaticRouterContext).statusCode = props.httpCode || 302;
          (staticContext as StaticRouterContext).url = props.to;
        }
        return <Redirect to={props.to} />;
      }}
    />
  );
}
