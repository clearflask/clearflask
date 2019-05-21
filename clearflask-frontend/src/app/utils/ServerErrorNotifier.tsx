import React from 'react';
import { Server } from '../../api/server';
import { useSnackbar } from 'notistack';

const ServerErrorNotifier = (props:({server:Server})) => {
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  props.server.subscribeToErrors(errorMsg =>
    enqueueSnackbar(errorMsg, { variant: 'error', preventDuplicate: true }))
  return null;
};

export default ServerErrorNotifier;
