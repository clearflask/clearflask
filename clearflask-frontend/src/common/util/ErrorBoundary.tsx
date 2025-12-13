// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { Box, Button } from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import React, { Component } from 'react';
import windowIso from '../windowIso';
import { vh } from './screenUtil';

export interface Props {
  hideOnError?: boolean;
}
export interface State {
  hasError?: boolean;
}
class ErrorBoundary extends Component<Props, State> {
  state: State = {};

  static getDerivedStateFromError(err: Error): Partial<State> | null {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      if (this.props.hideOnError) {
        return null;
      }
      return (
        <Box
          display='flex'
          justifyContent='center'
          alignItems='center'
          width='100%'
          height={vh(100)}
        >
          <Alert
            style={{
              margin: '40px auto',
              width: 'fit-content',
              minWidth: 'unset',
            }}
            variant='outlined'
            severity='error'
            action={(
              <Button onClick={() => !windowIso.isSsr && windowIso.location.reload(true)}>Refresh</Button>
            )}
          >
            Something went wrong!
          </Alert>
        </Box>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
