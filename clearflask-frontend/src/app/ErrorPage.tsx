import { Box, WithTheme, withTheme } from '@material-ui/core';
import React, { Component } from 'react';
import Message from '../common/Message';

interface Props {
  msg?: string | React.ReactNode;
  variant?: 'success' | 'warning' | 'error' | 'info';
}
class ErrorPage extends Component<Props & WithTheme> {
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
        height={this.props.theme.vh(100)}
      >
        <Message innerStyle={this.styles.message}
          message={this.props.msg}
          variant={this.props.variant || 'error'}
        />
      </Box>
    );
  }
}

export default withTheme(ErrorPage);
