import React, { Component } from 'react';
import * as Client from '../../api/client';
import { withStyles, Theme, createStyles, WithStyles } from '@material-ui/core/styles';
import { Typography, Tooltip } from '@material-ui/core';
import TimeAgo from 'react-timeago'
import Delimited from '../utils/Delimited';

const styles = (theme:Theme) => createStyles({
  comment: {
    margin: theme.spacing(2),
  },
  barItem: {
    whiteSpace: 'nowrap',
    margin: theme.spacing(0.5),
  },
  bottomBarLine: {
    display: 'flex',
    alignItems: 'center',
  },
  commentDeleted: {
    color: theme.palette.text.hint,
  },
  edited: {
    fontStyle: 'italic',
  },
});

interface Props {
  comment?:Client.CommentWithAuthor;
}

class Comment extends Component<Props&WithStyles<typeof styles, true>> {

  render() {
    return (
      <div className={this.props.classes.comment}>
        {this.props.comment && !this.props.comment.author ? (
          <Typography variant='overline' className={this.props.classes.commentDeleted}>Comment deleted</Typography>
        ) : (
        <Typography variant='body1'>
          {this.props.comment && this.props.comment.content}
        </Typography>
        )}
        {this.renderBottomBar()}
      </div>
    );
  }

  renderBottomBar() {
    if(!this.props.comment) return null;

    return (
      <div className={this.props.classes.bottomBarLine}>
        <Delimited>
          {[
            this.renderAuthor(),
            this.renderCreatedDatetime(),
            this.renderEdited(),
          ]}
        </Delimited>
      </div>
    );
  }

  renderEdited() {
    if(!this.props.comment || !this.props.comment.edited) return null;

    return (
      <Typography className={`${this.props.classes.barItem} ${this.props.classes.edited}`} variant='caption'>
        {!this.props.comment.author ? 'deleted' : 'edited'}
        &nbsp;
        <TimeAgo date={this.props.comment.edited} />
      </Typography>
    );
  }

  renderAuthor() {
    if(!this.props.comment
      || !this.props.comment.author
      || !this.props.comment.author.name) return null;

    return (
      <Typography className={this.props.classes.barItem} variant='caption'>
        {this.props.comment.author.name}
      </Typography>
    );
  }

  renderCreatedDatetime() {
    if(!this.props.comment) return null;

    return (
      <Typography className={this.props.classes.barItem} variant='caption'>
        <TimeAgo date={this.props.comment.created} />
      </Typography>
    );
  }
}

export default withStyles(styles, { withTheme: true })(Comment);
