import React from 'react';
import { Server } from '../../api/server';
import { useSnackbar } from 'notistack';
import ServerAdmin from '../../api/serverAdmin';
import { IconButton } from '@material-ui/core';
import CloseIcon from '@material-ui/icons/Close';

const ServerErrorNotifier = (props:({server:Server|ServerAdmin})) => {
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  props.server.subscribeToErrors((errorMsg, isUserFacing) => {
    console.log("Server error: " + errorMsg);
    if(isUserFacing) {
      enqueueSnackbar(errorMsg, {
        variant: 'error',
        preventDuplicate: false,
        action: (key) => (
          <IconButton aria-label="Close" color="inherit" onClick={() => closeSnackbar(key)}>
            <CloseIcon fontSize='small' />
          </IconButton>
        ),
      });
    }
  })
  return null;
};

export default ServerErrorNotifier;
