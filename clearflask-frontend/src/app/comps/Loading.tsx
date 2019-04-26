import React, { Component } from 'react';
import Fade from '@material-ui/core/Fade';
import CircularProgress from '@material-ui/core/CircularProgress';

interface Props {
  showImmediately?:boolean;
}

class Loading extends Component<Props> {
  readonly styles = {
    progress: {
      margin: 'auto',
    },
  };

  render() {
    return (
      <Fade in={true} timeout={this.props.showImmediately ? 0 : 3000}>
        <CircularProgress style={this.styles.progress} />
      </Fade>
    );
  }
}

export default Loading;
