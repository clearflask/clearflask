import React from 'react';
import { Server } from '../../api/server';
import { useSnackbar } from 'notistack';
import ServerAdmin from '../../api/serverAdmin';

const ServerErrorNotifier = (props:({server:Server|ServerAdmin})) => {
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  props.server.subscribeToErrors(errorMsg =>
    enqueueSnackbar(errorMsg, { variant: 'error', preventDuplicate: true }))
  return null;
};

export default ServerErrorNotifier;
