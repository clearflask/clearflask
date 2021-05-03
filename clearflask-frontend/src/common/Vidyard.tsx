import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import classNames from 'classnames';
import React, { Component } from 'react';
import { isTracking } from './util/detectEnv';
import windowIso from './windowIso';

var vidyardLoaded = false;

const styles = (theme: Theme) => createStyles({
  video: {
  },
});
export interface Props {
  className?: string;
  coverSrc: string;
  uuid: string;
}
class Vidyard extends Component<Props & WithStyles<typeof styles, true>> {
  componentDidMount() {
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

  render() {
    return (
      <img
        className={classNames('vidyard-player-embed', this.props.className, this.props.classes.video)}
        src={this.props.coverSrc}
        data-uuid={this.props.uuid}
        data-v="4"
        data-type="inline"
      />
    );
  }
}

export default withStyles(styles, { withTheme: true })(Vidyard);
