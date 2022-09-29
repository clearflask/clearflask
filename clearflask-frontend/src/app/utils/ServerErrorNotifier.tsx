// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { IconButton } from '@material-ui/core';
import CloseIcon from '@material-ui/icons/Close';
import { withSnackbar, WithSnackbarProps } from 'notistack';
import React, { Component } from 'react';
import { Server, Unsubscribe } from '../../api/server';

class ServerErrorNotifier extends Component<WithSnackbarProps> {
  unsubscribe?: Unsubscribe;

  componentDidMount() {
    this.unsubscribe = Server._subscribeToErrors((errorMsg, isUserFacing) => {
      console.log("Server error:", errorMsg);
      if (isUserFacing) {
        this.props.enqueueSnackbar(errorMsg, {
          variant: 'error',
          preventDuplicate: false,
          action: (key) => (
            <IconButton aria-label="Close" color="inherit" onClick={() => this.props.closeSnackbar(key)}>
              <CloseIcon fontSize='small' />
            </IconButton>
          ),
        });
      }
    }, 'ServerErrorNotifier');
  }

  componentWillUnmount() {
    this.unsubscribe && this.unsubscribe();
  }

  render() {
    return null;
  }
}

export default withSnackbar(ServerErrorNotifier);
