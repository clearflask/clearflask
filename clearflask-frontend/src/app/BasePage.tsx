import React, { Component } from 'react';

export default class BasePage extends Component {
  readonly styles = {
    page: {
      maxWidth: '1024px',
      padding: '40px',
      margin: '0px auto',
    },
  };

  render() {
    return (
      <div style={this.styles.page}>
        {this.props.children}
      </div>
    );
  }
}
