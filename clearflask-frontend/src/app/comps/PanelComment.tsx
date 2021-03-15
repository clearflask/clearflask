import { Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import * as Client from '../../api/client';
import { getSearchKey, ReduxState, Server, Status } from '../../api/server';
import notEmpty from '../../common/util/arrayUtil';
import ErrorMsg from '../ErrorMsg';
import Loading from '../utils/Loading';
import Comment from './Comment';
import LogIn from './LogIn';
import Panel from './Panel';

export enum Direction {
  Horizontal,
  Vertical,
}

interface SearchResult {
  status: Status;
  comments: Client.Comment[];
  cursor: string | undefined,
}

const styles = (theme: Theme) => createStyles({
  nothing: {
    margin: theme.spacing(4),
    color: theme.palette.text.secondary,
    width: '100%',
    maxWidth: 350,
  },
  comment: {
    minWidth: 200,
    maxWidth: 350,
  },
});
interface Props {
  className?: string;
  server: Server;
  title?: React.ReactNode;
  search: Client.CommentSearch;
  direction: Direction;
  maxHeight?: string | number;
  hideIfEmpty?: boolean;
  hideAuthor?: boolean;
}
interface ConnectProps {
  callOnMount?: () => void,
  searchResult: SearchResult;
  loggedInUser?: Client.UserMe;
}
interface State {
  logInOpen?: boolean;
}
class PanelComment extends Component<Props & ConnectProps & WithStyles<typeof styles, true>, State> {
  state: State = {};
  onLoggedIn?: () => void;

  constructor(props) {
    super(props);

    props.callOnMount?.();
  }

  render() {
    var content;
    switch (this.props.searchResult.status) {
      default:
      case Status.REJECTED:
        content = (
          <ErrorMsg msg='Failed to load' />
        );
        break;
      case Status.PENDING:
        if (this.props.hideIfEmpty) return null;
        content = (
          <Loading />
        );
        break;
      case Status.FULFILLED:
        if (this.props.hideIfEmpty && this.props.searchResult.comments.length === 0) return null;
        if (this.props.searchResult.comments.length === 0) {
          content = (
            <Typography variant='overline' className={this.props.classes.nothing}>Nothing found</Typography>
          )
        } else {
          const logIn = () => {
            if (this.props.loggedInUser) {
              return Promise.resolve();
            } else {
              return new Promise<void>(resolve => {
                this.onLoggedIn = resolve
                this.setState({ logInOpen: true });
              });
            }
          };
          content = this.props.searchResult.comments.map(comment => (
            <Comment
              key={comment && comment.commentId}
              className={this.props.classes.comment}
              server={this.props.server}
              comment={comment}
              loggedInUser={this.props.loggedInUser}
              logIn={logIn}
              linkToPost
              truncateLines={3}
              hideAuthor={this.props.hideAuthor}
            />
          ));
        }
        break;
    }
    return (
      <React.Fragment>
        <Panel
          className={this.props.className}
          title={this.props.title}
          direction={this.props.direction}
          maxHeight={this.props.maxHeight}
        >
          {content}
        </Panel>
        <LogIn
          actionTitle='Get notified of replies'
          server={this.props.server}
          open={this.state.logInOpen}
          onClose={() => this.setState({ logInOpen: false })}
          onLoggedInAndClose={() => {
            this.setState({ logInOpen: false });
            this.onLoggedIn && this.onLoggedIn();
            this.onLoggedIn = undefined;
          }}
        />
      </React.Fragment>
    );
  }
}

export default connect<ConnectProps, {}, Props, ReduxState>((state: ReduxState, ownProps: Props) => {
  var newProps: ConnectProps = {
    searchResult: {
      status: Status.PENDING,
      comments: [],
      cursor: undefined,
    } as SearchResult,
    loggedInUser: state.users.loggedIn.user,
  };

  const searchKey = getSearchKey(ownProps.search);
  const bySearch = state.comments.bySearch[searchKey];
  if (!bySearch) {
    newProps.callOnMount = () => {
      ownProps.server.dispatch().then(d => d.commentSearch({
        projectId: state.projectId!,
        commentSearch: ownProps.search,
      }));
    };
  } else {
    newProps.searchResult.status = bySearch.status;
    newProps.searchResult.cursor = bySearch.cursor;
    newProps.searchResult.comments = (bySearch.commentIds || [])
      .map(commentId => state.comments.byId[commentId]?.comment)
      .filter(notEmpty);
  }

  return newProps;
})(withStyles(styles, { withTheme: true })(PanelComment));
