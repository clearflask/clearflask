import React, { Component } from 'react';
import { Alert, Color } from '@material-ui/lab';

interface Props {
  innerStyle?:React.CSSProperties;
  message:React.ReactNode|string,
  variant:Color,
}

class Message extends Component<Props> {
  render() {
    return (
      <Alert style={this.props.innerStyle} severity={this.props.variant}>
        {this.props.message}
      </Alert>
    );
  }
}

export default Message;
