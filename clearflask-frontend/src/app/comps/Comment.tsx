import { Button, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import TimeAgo from 'react-timeago';
import * as Client from '../../api/client';
import { Server } from '../../api/server';
import ServerAdmin from '../../api/serverAdmin';
import notEmpty from '../../common/util/arrayUtil';
import Delimited from '../utils/Delimited';
import CommentEdit, { CommentDelete } from './CommentEdit';

const styles = (theme: Theme) => createStyles({
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
  editButton: {
    padding: `3px ${theme.spacing(0.5)}px`,
    whiteSpace: 'nowrap',
    minWidth: 'unset',
    color: theme.palette.text.hint,
  },
  grow: {
    flexGrow: 1,
  },
  pre: {
    whiteSpace: 'pre-wrap',
  },
  editIconButton: {
    padding: '0px',
    color: theme.palette.text.hint,
  },
});

interface Props {
  server: Server;
  comment?: Client.CommentWithAuthor;
  loggedInUser?: Client.User;
}
interface State {
  editExpanded?: boolean;
  adminDeleteExpanded?: boolean;
  deleteExpanded?: boolean;
}

class Comment extends Component<Props & WithStyles<typeof styles, true>, State> {
  state: State = {};

  render() {
    return (
      <div className={this.props.classes.comment}>
        {this.props.comment && !this.props.comment.author ? (
          <Typography variant='overline' className={this.props.classes.commentDeleted}>Comment deleted</Typography>
        ) : (
            <Typography variant='body1' className={this.props.classes.pre}>
              {this.props.comment && this.props.comment.content}
            </Typography>
          )}
        {this.renderBottomBar()}
      </div>
    );
  }

  renderBottomBar() {
    if (!this.props.comment) return null;

    const leftSide = [
      this.renderAuthor(),
      this.renderCreatedDatetime(),
      this.renderEdited(),
      this.renderAdminDelete(),
      this.renderEdit(),
    ].filter(notEmpty);
    const rightSide = [
    ].filter(notEmpty);

    if (leftSide.length + rightSide.length === 0) return null;

    return (
      <div className={this.props.classes.bottomBarLine}>
        <Delimited>
          {leftSide}
        </Delimited>
        <div className={this.props.classes.grow} />
        <Delimited>
          {rightSide}
        </Delimited>
      </div>
    );
  }

  renderAdminDelete() {
    if (!this.props.comment
      || !this.props.comment.author
      || !ServerAdmin.get().isAdminLoggedIn()
      // Only show admin delete if the regular edit is not shown as it already contains a delete
      || (this.props.loggedInUser && this.props.comment.authorUserId === this.props.loggedInUser.userId)) return null;

    return (
      <React.Fragment>
        <Button key='edit' variant='text' className={this.props.classes.editButton}
          onClick={e => this.setState({ adminDeleteExpanded: !this.state.adminDeleteExpanded })}>
          <Typography variant='caption'>Delete</Typography>
        </Button>
        {this.state.adminDeleteExpanded !== undefined && (
          <CommentDelete
            key={this.props.comment.commentId}
            server={this.props.server}
            comment={this.props.comment}
            asAdmin={true}
            open={this.state.adminDeleteExpanded}
            onClose={() => this.setState({ adminDeleteExpanded: false })}
          />
        )}
      </React.Fragment>
    );
  }

  renderEdit() {
    if (!this.props.comment
      || !this.props.comment.author
      || !(this.props.loggedInUser && this.props.comment.authorUserId === this.props.loggedInUser.userId)) return null;

    return (
      <React.Fragment>
        <Button key='edit' variant='text' className={this.props.classes.editButton}
          onClick={e => this.setState({ editExpanded: !this.state.editExpanded })}>
          <Typography variant='caption'>Edit</Typography>
        </Button>
        {this.state.editExpanded !== undefined && (
          <CommentEdit
            key={this.props.comment.commentId}
            server={this.props.server}
            comment={this.props.comment}
            loggedInUser={this.props.loggedInUser}
            open={this.state.editExpanded}
            onClose={() => this.setState({ editExpanded: false })}
          />
        )}
      </React.Fragment>
    );
  }

  renderEdited() {
    if (!this.props.comment || !this.props.comment.edited) return null;

    return (
      <Typography className={`${this.props.classes.barItem} ${this.props.classes.edited}`} variant='caption'>
        {!this.props.comment.author ? 'deleted' : 'edited'}
        &nbsp;
        <TimeAgo date={this.props.comment.edited} />
      </Typography>
    );
  }

  renderAuthor() {
    if (!this.props.comment
      || !this.props.comment.author
      || !this.props.comment.author.name) return null;

    return (
      <Typography className={this.props.classes.barItem} variant='caption'>
        {this.props.comment.author.name}
      </Typography>
    );
  }

  renderCreatedDatetime() {
    if (!this.props.comment) return null;

    return (
      <Typography className={this.props.classes.barItem} variant='caption'>
        <TimeAgo date={this.props.comment.created} />
      </Typography>
    );
  }
}

export default withStyles(styles, { withTheme: true })(Comment);
