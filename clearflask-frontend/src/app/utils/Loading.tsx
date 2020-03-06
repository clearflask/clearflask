import CircularProgress from '@material-ui/core/CircularProgress';
import Fade from '@material-ui/core/Fade';
import React, { Component } from 'react';

interface Props {
  showImmediately?: boolean;
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
