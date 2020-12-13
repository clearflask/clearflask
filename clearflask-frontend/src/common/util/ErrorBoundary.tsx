import { Box, Button } from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import React, { Component } from 'react';
import { vh } from './vhUtil';

export interface Props {
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
              <Button onClick={() => window.location.reload(true)}>Refresh</Button>
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
