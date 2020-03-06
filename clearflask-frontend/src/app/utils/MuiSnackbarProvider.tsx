import { createStyles, Theme, withStyles } from '@material-ui/core/styles';
import { SnackbarProvider } from 'notistack';
import React from 'react';

const muiSnackbarStyles = createStyles({
  snackbarRoot: {
    position: 'fixed', // Keep the snackbar above dialogs AND scroll with the page
  },
});
const MuiSnackbarProvider = withStyles((theme: Theme) => muiSnackbarStyles, { withTheme: true })((props: any) => (
  <SnackbarProvider
    maxSnack={3}
    hideIconVariant
    classes={{
      root: props.classes.snackbarRoot,
    }}
  // content={(key, message) => (
  //   <Alert id={key} message={message} />
  // )}
  >
    {props.children}
  </SnackbarProvider>
));

export default MuiSnackbarProvider;
