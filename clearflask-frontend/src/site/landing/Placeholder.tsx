import React, { Component } from 'react';

interface Props {
  width?: string | number;
  height?: string | number;
  center?: boolean;
}

class Placeholder extends Component<Props> {
  render() {
    return (
      <div style={{
        width: this.props.width || '100%',
        height: this.props.height || '100%',
        border: '1px dashed rgba(0,0,0,0.3)',
        ...(this.props.center && { margin: '0px, auto' }),
      }}>
        &nbsp;
        {this.props.children}
      </div>
    );
  }
}

export default Placeholder;
