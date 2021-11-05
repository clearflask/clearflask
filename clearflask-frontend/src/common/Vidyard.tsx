// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import classNames from 'classnames';
import React, { Component } from 'react';
import ImgIso from './ImgIso';
import { isTracking } from './util/detectEnv';
import windowIso from './windowIso';

var vidyardLoaded = false;

const styles = (theme: Theme) => createStyles({
  video: {
  },
});
export interface Props {
  className?: string;
  image: Img;
  uuid: string;
}
class Vidyard extends Component<Props & WithStyles<typeof styles, true>> {
  constructor(props) {
    super(props);

    if (!windowIso.isSsr && !vidyardLoaded) {
      if (isTracking()) {
        windowIso['onVidyardAPI'] = (vidyardEmbed) => {
          vidyardEmbed.api.addReadyListener((_, player) => {
            var scriptTag = document.createElement('script');
            scriptTag.src = "//play.vidyard.com/v0/google-analytics.js";
            document.body.appendChild(scriptTag);
          });
        };
      }

      var scriptTag = document.createElement('script');
      scriptTag.src = "//play.vidyard.com/embed/v4.js";
      document.body.appendChild(scriptTag);

      vidyardLoaded = true;
    }
  }

  componentDidMount() {
    !windowIso.isSsr && windowIso['vidyardEmbed']?.api.renderDOMPlayers();
  }

  componentDidUpdate() {
    !windowIso.isSsr && windowIso['vidyardEmbed']?.api.renderDOMPlayers();
  }

  render() {
    return (
      <ImgIso
        className={classNames('vidyard-player-embed', this.props.className, this.props.classes.video)}
        imgClassName='vidyard-player-embed'
        alt=''
        src={this.props.image.src}
        aspectRatio={this.props.image.aspectRatio}
        width={!this.props.image.aspectRatio ? '100%' : undefined}
        maxWidth={this.props.image.width}
        maxHeight={this.props.image.height}
        imgProps={{
          'data-uuid': this.props.uuid,
          'data-v': '4',
          'data-type': 'inline',
        }}
      />
    );
  }
}

export default withStyles(styles, { withTheme: true })(Vidyard);
