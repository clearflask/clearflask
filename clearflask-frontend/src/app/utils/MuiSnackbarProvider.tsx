import { createStyles, Theme, withStyles, makeStyles } from '@material-ui/core/styles';
import { SnackbarProvider, useSnackbar, WithSnackbarProps } from 'notistack';
import React from 'react';
import { Button, IconButton } from '@material-ui/core';
import DismissIcon from '@material-ui/icons/CloseRounded';

const muiSnackbarStyles = makeStyles({
  dismissButton: {
    color: 'white',
  },
});
const MuiSnackbarProvider = (props: any) => {
  const notistackRef = React.createRef<any>();
  const classes = muiSnackbarStyles();
  return (
    <SnackbarProvider
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
          onClick={() => notistackRef.current?.closeSnackbar(key) }
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
