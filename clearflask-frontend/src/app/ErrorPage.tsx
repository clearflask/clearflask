import React, { Component } from 'react';
import Message from './comps/Message';

interface Props {
  msg?:string;
  variant?:'success'|'warning'|'error'|'info';
}

export default class ErrorPage extends Component<Props> {
  readonly styles = {
    message: {
      margin: '40px auto',
    },
  };

  render() {
    return (
      <Message innerStyle={this.styles.message}
        message={this.props.msg}
        variant={this.props.variant || 'error'}
      />
    );
  }
}
