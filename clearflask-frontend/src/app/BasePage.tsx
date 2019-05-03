import React, { Component } from 'react';

export default class BasePage extends Component {
  readonly styles = {
    // Required for AnimatedSwitch to overlap two pages during animation
    animationContainer: {
      position: 'absolute' as 'absolute',
      width: '100%',
    },
    page: {
      maxWidth: '1024px',
      margin: '0px auto',
    },
    anchor: {
      position: 'relative' as 'relative',
    }
  };

  render() {
    return (
      <div style={this.styles.animationContainer}>
        <div style={this.styles.page}>
          <div style={this.styles.anchor}>
            {this.props.children}
          </div>
        </div>
      </div>
    );
  }
}
