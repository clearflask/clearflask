// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import CircularProgress from '@material-ui/core/CircularProgress';
import Fade from '@material-ui/core/Fade';
import React, { useContext, useEffect } from 'react';
import { ReactReduxContext } from 'react-redux';
import { hideLoading, showLoading } from 'react-redux-loading-bar';

const delay = 3000;

export default function Loading(props: {
  showImmediately?: boolean;
}) {
  const redux = useContext(ReactReduxContext);
  useEffect(() => {
    var loadingShown = false;
    const show = () => {
      redux?.store?.dispatch?.(showLoading());
      loadingShown = true;
    };
    var timeout;
    if (props.showImmediately) {
      show();
    } else {
      timeout = setTimeout(show, delay);
    }
    return () => {
      clearTimeout(timeout);
      if (loadingShown) redux?.store?.dispatch?.(hideLoading());
    };
  }, []);
  return (
    <Fade appear in timeout={props.showImmediately ? 0 : delay}>
      <CircularProgress style={{
        margin: 'auto',
        // This is just a patch, circular progress flashes unstyled with SSR taking up whole page.
        // Just at least don't cover the whole page...
        maxWidth: 40, maxHeight: 40,
      }} />
    </Fade>
  );
}
