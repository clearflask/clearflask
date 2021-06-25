import { Box, WithTheme, withTheme } from '@material-ui/core';
import React, { Component } from 'react';
import Message from '../common/Message';

interface Props {
  msg?: string | React.ReactNode;
  variant?: 'success' | 'warning' | 'error' | 'info';
  height?: string | number | undefined;
}
class ErrorPage extends Component<Props & WithTheme> {
  readonly styles = {
    message: {
      margin: '80px auto',
      width: 'fit-content',
      minWidth: 'unset',
    },
  };

  render() {
    return (
      <Box
        display='flex'
        justifyContent='center'
        alignItems='center'
        width='100%'
        height='100%'
      >
        <Message innerStyle={this.styles.message}
          message={this.props.msg}
          severity={this.props.variant || 'error'}
        />
      </Box>
    );
  }
}

export default withTheme(ErrorPage);
