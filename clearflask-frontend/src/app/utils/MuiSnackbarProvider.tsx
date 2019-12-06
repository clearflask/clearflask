import React from 'react';
import { SnackbarProvider, useSnackbar } from 'notistack';
import { withStyles, Theme, createStyles } from '@material-ui/core/styles';

const muiSnackbarStyles = createStyles({
  snackbarRoot: {
    position: 'fixed', // Keep the snackbar above dialogs AND scroll with the page
  },
});
const MuiSnackbarProvider = withStyles((theme:Theme) => muiSnackbarStyles, { withTheme: true })((props:any) => (
  <SnackbarProvider
    maxSnack={3}
    hideIconVariant
    classes={{
      root: props.classes.snackbarRoot,
    }}
  >
    {props.children}
  </SnackbarProvider>
));

export default MuiSnackbarProvider;
