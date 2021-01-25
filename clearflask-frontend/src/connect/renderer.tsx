import React from 'react';
import { StaticRouterContext } from 'react-router';
import Main, { StoresInitialState } from "../Main";
import ReactDOMServer from 'react-dom/server';

export const renderCfToString = (
    location: string,
    staticRouterContext: StaticRouterContext,
    storesInitialState: StoresInitialState,
) => {
    return ReactDOMServer.renderToString(
        <Main
          ssrLocation={location}
          ssrStaticRouterContext={staticRouterContext}
          ssrStoresInitialState={storesInitialState}
        />
    );
}
