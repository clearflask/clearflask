import React from 'react';
import { Route } from "react-router";

// https://reactrouter.com/web/guides/server-rendering/404-401-or-any-other-status
export function RouteWithStatus({ httpCode, children }) {
  return (
    <Route
      render={({ staticContext }) => {
        if (staticContext) staticContext.statusCode = httpCode;
        return children;
      }}
    />
  );
}
