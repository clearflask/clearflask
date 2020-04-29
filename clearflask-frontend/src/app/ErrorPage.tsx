import { Box } from '@material-ui/core';
import React, { Component } from 'react';
import Message from '../common/Message';

interface Props {
  msg?: string | React.ReactNode;
  variant?: 'success' | 'warning' | 'error' | 'info';
}

export default class ErrorPage extends Component<Props> {
  readonly styles = {
    message: {
      margin: '40px auto',
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
        height='100vh'
      >
        <Message innerStyle={this.styles.message}
          message={this.props.msg}
          variant={this.props.variant || 'error'}
        />
      </Box>
    );
  }
}
