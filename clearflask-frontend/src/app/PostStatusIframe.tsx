import { Link } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';

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
}
class PostStatusIframe extends Component<Props & WithStyles<typeof styles, true>> {
  render() {
    const src = `${window.location.protocol}//${this.props.projectId || 'feedback'}.${window.location.host}/embed-status/post/${this.props.postId}`;
    return (
      <iframe
        className={this.props.classes.iframe}
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
