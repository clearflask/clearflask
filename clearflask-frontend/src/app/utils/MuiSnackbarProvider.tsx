// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { IconButton, Theme } from '@material-ui/core';
import { createStyles, makeStyles } from '@material-ui/core/styles';
import DismissIcon from '@material-ui/icons/CloseRounded';
import { SnackbarProvider } from 'notistack';
import React from 'react';

// Matches Mui Alert: https://github.com/mui-org/material-ui/blob/master/packages/material-ui-lab/src/Alert/Alert.js#L27
const muiSnackbarStyles = makeStyles((theme: Theme) => {
  return createStyles({
    snackbar: {
    },
    dismissButton: {
      color: 'white',
    },
    standardWarning: {
      backgroundColor: '#bd9700',
    },
  });
});
const MuiSnackbarProvider = (props: {
  children: React.ReactNode;
  notistackRef?: React.RefObject<SnackbarProvider>;
}) => {
  const notistackRef = props.notistackRef || React.createRef<SnackbarProvider>();
  const classes = muiSnackbarStyles();
  return (
    <SnackbarProvider
      classes={{
        root: classes.snackbar,
        variantWarning: classes.standardWarning,
      }}
      ref={notistackRef}
      preventDuplicate
      maxSnack={3}
      hideIconVariant
      anchorOrigin={{
        vertical: 'bottom',
        horizontal: 'left',
      }}
      action={key => (
        <IconButton
          className={classes.dismissButton}
          onClick={() => notistackRef.current?.closeSnackbar(key)}
        >
          <DismissIcon fontSize='inherit' />
        </IconButton>
      )}
    >
      {props.children}
    </SnackbarProvider>
  )
};

export default MuiSnackbarProvider;
