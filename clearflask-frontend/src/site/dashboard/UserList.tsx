import { Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import classNames from 'classnames';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import * as Admin from '../../api/admin';
import * as Client from '../../api/client';
import { getSearchKey, ReduxState, Server, Status } from '../../api/server';
import ErrorMsg from '../../app/ErrorMsg';
import Loading from '../../app/utils/Loading';
import { contentScrollApplyStyles, Orientation } from '../../common/ContentScroll';
import UserWithAvatarDisplay from '../../common/UserWithAvatarDisplay';
import { notEmpty } from '../../common/util/arrayUtil';
import keyMapper from '../../common/util/keyMapper';
import { TabFragment, TabsVertical } from '../../common/util/tabsUtil';

interface SearchResult {
  status: Status;
  users: Admin.UserAdmin[];
  cursor: string | undefined,
}

const styles = (theme: Theme) => createStyles({
  placeholder: {
    padding: theme.spacing(4),
    color: theme.palette.text.secondary,
    boxSizing: 'border-box',
    minWidth: 300,
    width: '100%',
    display: 'inline-block',
  },
  user: {
    padding: theme.spacing(2, 4),
    backgroundColor: theme.palette.background.default,
  },
  scroll: {
    flexGrow: 1,
    minHeight: 0,
    ...contentScrollApplyStyles({ theme, orientation: Orientation.Vertical }),
  },
});
interface Props {
  server: Server;
  search?: Partial<Admin.UserSearchAdmin>;
  selectable?: boolean;
  selected?: string;
  onUserClick: (userId: string) => void;
  scroll?: boolean;
}
interface ConnectProps {
  callOnMount?: () => void,
  configver?: string;
  config?: Client.Config;
  searchResult: SearchResult;
}
class UserList extends Component<Props & ConnectProps & WithStyles<typeof styles, true>> {

  constructor(props) {
    super(props);

    props.callOnMount?.();
  }

  render() {
    switch (this.props.searchResult.status) {
      default:
      case Status.REJECTED:
        return (
          <div className={this.props.classes.placeholder}>
            <ErrorMsg msg='Failed to load' />
          </div>
        );
      case Status.PENDING:
        return (
          <div className={this.props.classes.placeholder}>
            <Loading />
          </div>
        );
      case Status.FULFILLED:
        if (this.props.searchResult.users.length === 0) {
          return (
            <div className={this.props.classes.placeholder}>
              <Typography variant='overline'>Nothing found</Typography>
            </div>
          );
        } else {
          var content: React.ReactNode = this.props.searchResult.users.map(user => {
            var userContent = (
              <UserWithAvatarDisplay
                backgroundColor='default'
                className={classNames(
                  this.props.classes.user,
                )}
                user={user}
                onClick={() => this.props.onUserClick(user.userId)}
              />
            );
            if (this.props.selectable) {
              userContent = (
                <TabFragment key={user.userId} value={user.userId}>
                  {userContent}
                </TabFragment>
              );
            } else {
              userContent = (
                <React.Fragment key={user.userId}>
                  {userContent}
                </React.Fragment>
              );
            }
            return userContent;
          });
          if (this.props.selectable) {
            content = (
              <TabsVertical
                selected={this.props.selected}
                onClick={postId => this.props.onUserClick(postId)}
              >
                {content}
              </TabsVertical>
            );
          }
          content = (
            <div className={classNames(
              this.props.scroll && this.props.classes.scroll,
            )}>
              {content}
            </div>
          );
          return content;
        }
    }
  }
}

export default keyMapper(
  (ownProps: Props) => getSearchKey(ownProps.search),
  connect<ConnectProps, {}, Props, ReduxState>((state, ownProps) => {
    const newProps: ConnectProps = {
      configver: state.conf.ver, // force rerender on config change
      config: state.conf.conf,
      searchResult: {
        status: Status.PENDING,
        users: [],
        cursor: undefined,
      } as SearchResult,
    };

    const searchKey = getSearchKey(ownProps.search);
    const bySearch = state.users.bySearch[searchKey];
    if (!bySearch) {
      newProps.callOnMount = () => {
        ownProps.server.dispatchAdmin({ ssr: true }).then(d => d.userSearchAdmin({
          projectId: state.projectId!,
          userSearchAdmin: ownProps.search || {},
        }));
      };
    } else {
      newProps.searchResult.status = bySearch.status;
      newProps.searchResult.cursor = bySearch.cursor;
      newProps.searchResult.users = (bySearch.userIds || []).map(userId => {
        const user = state.users.byId[userId];
        if (!user || user.status !== Status.FULFILLED) return undefined;
        // Admin.UserAdmin type guard
        if (user.user?.['hasPassword'] === undefined) return undefined;
        return user.user as Admin.UserAdmin;
      }).filter(notEmpty);
    }

    return newProps;
  }, null, null, { forwardRef: true })(withStyles(styles, { withTheme: true })(UserList)));
