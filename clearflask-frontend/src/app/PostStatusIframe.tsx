import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import QueryString from 'query-string';
import React, { Component } from 'react';
import { detectEnv, Environment } from '../common/util/detectEnv';
import windowIso from '../common/windowIso';
import { PostStatusConfig } from './PostStatus';

const styles = (theme: Theme) => createStyles({
  iframe: {
    display: 'inline-block',
    border: 'none',
    margin: 0,
    padding: 0,
    width: 160,
    height: 32,
    overflow: 'hidden',
  },
});
interface Props {
  postId: string;
  projectId?: string; // Defaults to ClearFlask
  config?: PostStatusConfig;
  height?: string | number;
  width?: string | number;
}
class PostStatusIframe extends Component<Props & WithStyles<typeof styles, true>> {
  render() {
    const query = this.props.config ? '?' + QueryString.stringify(this.props.config) : '';
    const src = `${windowIso.location.protocol}//${this.props.projectId || detectEnv() === Environment.DEVELOPMENT_FRONTEND ? 'mock' : 'clearflask'}.${windowIso.location.host}/embed-status/post/${this.props.postId}${query}`;
    return (
      <iframe
        className={this.props.classes.iframe}
        style={{
          width: this.props.width,
          height: this.props.height,
        }}
        allowTransparency={true}
        scrolling='no'
        src={src}
        title='Status frame'
        frameBorder={0}
      />
    );
  }
}

export default withStyles(styles, { withTheme: true })(PostStatusIframe);
