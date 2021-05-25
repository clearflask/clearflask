import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import classNames from 'classnames';
import QueryString from 'query-string';
import React, { Component } from 'react';
import { detectEnv, Environment } from '../common/util/detectEnv';
import windowIso from '../common/windowIso';
import { PostStatusConfig } from './PostStatus';

export const getPostStatusIframeSrc = (
  postId: string,
  projectId?: string, // Defaults to ClearFlask
  config?: PostStatusConfig
) => `${windowIso.location.protocol}//${projectId || detectEnv() === Environment.DEVELOPMENT_FRONTEND ? 'mock' : 'clearflask'}.${windowIso.location.host}/embed-status/post/${postId}${config ? '?' + QueryString.stringify(config) : ''}`;

const styles = (theme: Theme) => createStyles({
  iframe: {
    display: 'inline-block',
    border: 'none',
    margin: 0,
    padding: 0,
    width: 160,
    height: 32,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
});
interface Props {
  className?: string;
  postId: string;
  projectId?: string; // Defaults to ClearFlask
  config?: PostStatusConfig;
  height?: string | number;
  width?: string | number;
}
class PostStatusIframe extends Component<Props & WithStyles<typeof styles, true>> {
  render() {
    return (
      <iframe
        className={classNames(this.props.className, this.props.classes.iframe)}
        style={{
          width: this.props.width,
          height: this.props.height,
        }}
        scrolling='no'
        src={getPostStatusIframeSrc(
          this.props.postId,
          this.props.projectId,
          this.props.config,
        )}
        title='Status frame'
        frameBorder={0}
        allowTransparency={true}
      />
    );
  }
}

export default withStyles(styles, { withTheme: true })(PostStatusIframe);
