// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import CircularProgress from '@material-ui/core/CircularProgress';
import Fade from '@material-ui/core/Fade';
import React, { Component } from 'react';

export interface Props {
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
      <Fade appear in timeout={this.props.showImmediately ? 0 : 3000}>
        <CircularProgress style={{
          ...this.styles.progress,
          // This is just a patch, circular progress flashes unstyled with SSR taking up whole page.
          // Just at least don't cover the whole page...
          maxWidth: 40, maxHeight: 40,
        }} />
      </Fade>
    );
  }
}

export default Loading;
