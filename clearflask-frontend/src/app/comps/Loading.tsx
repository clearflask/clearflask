import React, { Component } from 'react';
import Fade from '@material-ui/core/Fade';
import CircularProgress from '@material-ui/core/CircularProgress';

interface Props {
}

class Loading extends Component<Props> {

  render() {
    return (
      <Fade in={true} timeout={3000}>
        <CircularProgress />
      </Fade>
    );
  }
}

export default Loading;
