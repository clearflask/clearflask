import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import * as Client from '../../api/client';
import { ReduxState, Server, Status } from '../../api/server';
import ErrorPage from '../ErrorPage';
import Post from './Post';

const styles = (theme: Theme) => createStyles({
  container: {
    margin: theme.spacing(1),
    display: 'flex',
  },
});

export type IdeaCardVariant = 'title' | 'full';

interface Props extends WithStyles<typeof styles, true> {
  server: Server;
  postId: string;
  // connect
  postStatus: Status;
  post?: Client.Idea;
}

class PostPage extends Component<Props> {
  render() {
    if (this.props.postStatus === Status.REJECTED) {
      return (<ErrorPage msg='Oops, failed to load' />);
    } else if (this.props.postStatus === Status.FULFILLED && this.props.post === undefined) {
      return (<ErrorPage msg='Oops, not found' />);
    }

    return (<Post server={this.props.server} idea={this.props.post} variant='page' />);
  }
}

export default connect<any, any, any, any>((state: ReduxState, ownProps: Props) => {
  var newProps: { postStatus: Status; post?: Client.Idea; } = {
    postStatus: Status.PENDING,
    post: undefined,
  };

  const byId = state.ideas.byId[ownProps.postId];
  if (!byId) {
    ownProps.server.dispatch().ideaGet({
      projectId: state.projectId,
      ideaId: ownProps.postId,
    });
  } else {
    newProps.postStatus = byId.status;
    newProps.post = byId.idea;
  }

  return newProps;
})(withStyles(styles, { withTheme: true })(PostPage));
