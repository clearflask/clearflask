import React from 'react';
import { SnackbarProvider } from 'notistack';
import { withStyles, Theme, createStyles } from '@material-ui/core/styles';

const muiSnackbarStyles = createStyles({
  snackbarRoot: {
    position: 'absolute',
  },
});
const MuiSnackbarProvider = withStyles((theme:Theme) => muiSnackbarStyles, { withTheme: true })((props:any) => (
  <SnackbarProvider maxSnack={3} classes={{
    root: props.classes.snackbarRoot,
  }}>
    {props.children}
  </SnackbarProvider>
));

export default MuiSnackbarProvider;
