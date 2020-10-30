import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import * as Client from '../../api/client';
import { ReduxState, Server, Status } from '../../api/server';
import { truncateWithElipsis } from '../../common/util/stringUtil';
import setTitle from '../../common/util/titleUtil';
import ErrorPage from '../ErrorPage';
import Post from './Post';

const styles = (theme: Theme) => createStyles({
  container: {
    margin: theme.spacing(1),
    display: 'flex',
  },
});
interface Props {
  server: Server;
  postId: string;
  PostProps?: Partial<React.ComponentProps<typeof Post>>;
}
interface ConnectProps {
  postStatus: Status;
  post?: Client.Idea;
  suppressSetTitle?: boolean,
}
class PostPage extends Component<Props & ConnectProps & WithStyles<typeof styles, true>> {
  render() {
    if (this.props.post && !this.props.suppressSetTitle) {
      setTitle(truncateWithElipsis(25, this.props.post.title), true);
    }

    if (this.props.postStatus === Status.REJECTED) {
      if (!this.props.suppressSetTitle) {
        setTitle("Failed to load");
      }
      return (<ErrorPage msg='Oops, failed to load' />);
    } else if (this.props.postStatus === Status.FULFILLED && this.props.post === undefined) {
      if (!this.props.suppressSetTitle) {
        setTitle("Not found");
      }
      return (<ErrorPage msg='Oops, not found' />);
    }

    return (<Post server={this.props.server} idea={this.props.post} variant='page' {...this.props.PostProps} />);
  }
}

export default connect<ConnectProps, {}, Props, ReduxState>((state: ReduxState, ownProps: Props) => {
  var newProps: ConnectProps = {
    postStatus: Status.PENDING,
    post: undefined,
    suppressSetTitle: state.settings.suppressSetTitle,
  };

  const byId = state.ideas.byId[ownProps.postId];
  if (!byId) {
    ownProps.server.dispatch().ideaGet({
      projectId: state.projectId!,
      ideaId: ownProps.postId,
    });
  } else {
    newProps.postStatus = byId.status;
    newProps.post = byId.idea;
  }

  return newProps;
})(withStyles(styles, { withTheme: true })(PostPage));
