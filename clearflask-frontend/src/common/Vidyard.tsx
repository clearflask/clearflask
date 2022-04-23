// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import classNames from 'classnames';
import React, { Component } from 'react';
import ImgIso from './ImgIso';
import { trackingBlock } from './util/trackingDelay';
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
      windowIso['onVidyardAPI'] = (vidyardEmbed) => {
        vidyardEmbed.api.addReadyListener((_, player) => {
          trackingBlock(() => {
            var scriptTag = document.createElement('script');
            scriptTag.src = "//play.vidyard.com/v0/google-analytics.js";
            document.body.appendChild(scriptTag);
          });
        });
      };

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
