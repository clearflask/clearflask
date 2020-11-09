import { Button, InputAdornment, TextField, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import FilterIcon from '@material-ui/icons/SearchRounded';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import * as Admin from '../../api/admin';
import * as Client from '../../api/client';
import { ReduxState, Server } from '../../api/server';
import Comment from '../../app/comps/Comment';
import ExplorerTemplate from '../../app/comps/ExplorerTemplate';
import LogIn from '../../app/comps/LogIn';
import Loader from '../../app/utils/Loader';
import debounce, { SearchTypeDebounceTime } from '../../common/util/debounce';

const searchWidth = 100;
const styles = (theme: Theme) => createStyles({
  page: {
    maxWidth: 1024,
  },
  searchInput: {
    margin: theme.spacing(1),
    width: searchWidth,
    // (Un)comment these to align with corner
    marginBottom: -1,
  },
  nothing: {
    margin: theme.spacing(4),
    color: theme.palette.text.secondary,
  },
  resultContainer: {
    paddingTop: theme.spacing(2),
    paddingLeft: theme.spacing(2),
  },
  userProperties: {
    margin: theme.spacing(2),
  },
  key: {
    margin: theme.spacing(1),
  },
  value: {
    margin: theme.spacing(1),
  },
  created: {
    whiteSpace: 'nowrap',
  },
  searchIcon: {
    color: theme.palette.text.hint,
  },
});

interface Props {
  server: Server;
  onCommentClick: (postId: string, commentId: string) => void;
  onUserClick?: (userId: string) => void;
}
interface ConnectProps {
  loggedInUser?: Client.User;
}
interface State {
  searchInput?: string;
  searchText?: string;
  searchResult?: Admin.CommentWithVote[];
  searchCursor?: string;
  logInOpen?: boolean;
}
class CommentsPage extends Component<Props & ConnectProps & WithStyles<typeof styles, true>, State> {
  readonly updateSearchText: (text?: string) => void;
  readonly createInputRef: React.RefObject<HTMLInputElement> = React.createRef();
  onLoggedIn?: () => void;

  constructor(props) {
    super(props);
    this.state = {};
    this.updateSearchText = debounce(this.search.bind(this), SearchTypeDebounceTime);
    this.search();
  }

  render() {
    return (
      <div className={this.props.classes.page}>
        <ExplorerTemplate
          searchSize={searchWidth}
          search={(
            <TextField
              className={this.props.classes.searchInput}
              placeholder='Search'
              value={this.state.searchInput || ''}
              onChange={e => {
                this.setState({
                  searchInput: e.target.value,
                  searchText: e.target.value,
                });
                this.updateSearchText(e.target.value);
              }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <FilterIcon color='inherit' className={this.props.classes.searchIcon} />
                  </InputAdornment>
                ),
              }}
            />
          )}
          content={(
            <div className={this.props.classes.resultContainer}>
              {this.state.searchResult && this.state.searchResult.length > 0
                ? (
                  <React.Fragment>
                    {this.state.searchResult.map((comment, index) => (
                      <Comment
                        key={comment.commentId}
                        server={this.props.server}
                        onCommentClick={!!this.props.onCommentClick ? () => this.props.onCommentClick(comment.ideaId, comment.commentId) : undefined}
                        onAuthorClick={this.props.onUserClick}
                        comment={comment}
                        loggedInUser={this.props.loggedInUser}
                        logIn={() => {
                          if (this.props.loggedInUser) {
                            return Promise.resolve();
                          } else {
                            return new Promise<void>(resolve => {
                              this.onLoggedIn = resolve
                              this.setState({ logInOpen: true });
                            });
                          }
                        }}
                        onUpdated={() => this.search(this.state.searchText)}
                      />
                    ))}
                    {!!this.state.searchCursor && (
                      <Button
                        style={{ margin: 'auto', display: 'block' }}
                        onClick={() => this.search(this.state.searchText, this.state.searchCursor)}
                      >
                        Show more
                      </Button>
                    )}
                  </React.Fragment>
                ) : (
                  <div className={this.props.classes.nothing}>
                    <Loader loaded={this.state.searchResult !== undefined}>
                      <Typography variant='overline'>No comments found</Typography>
                    </Loader>
                  </div>
                )}
            </div>
          )}
        />
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
      </div>
    );
  }

  // TODO Use the redux state here instead of react state
  search(text?: string, cursor?: string) {
    this.props.server.dispatchAdmin()
      .then(d => d.commentSearchAdmin({
        projectId: this.props.server.getProjectId(),
        cursor: cursor,
        commentSearchAdmin: {
          searchText: text,
        },
      }))
      .then(result => this.setState({
        searchResult: cursor
          ? [...(this.state.searchResult || []), ...result.results]
          : result.results,
        searchCursor: result.cursor,
      }));
  }
}

export default connect<ConnectProps, {}, Props, ReduxState>((state: ReduxState, ownProps: Props): ConnectProps => {
  // TODO Use the redux state here instead of react state
  const connectProps: ConnectProps = {
    loggedInUser: state.users.loggedIn.user,
  };
  return connectProps;
})(withStyles(styles, { withTheme: true })(CommentsPage));
