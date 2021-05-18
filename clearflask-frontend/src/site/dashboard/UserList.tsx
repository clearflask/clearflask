import { Divider, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import * as Admin from '../../api/admin';
import * as Client from '../../api/client';
import { getSearchKey, ReduxState, Server, Status } from '../../api/server';
import ErrorMsg from '../../app/ErrorMsg';
import Loading from '../../app/utils/Loading';
import AvatarDisplay from '../../common/AvatarDisplay';
import UserDisplay from '../../common/UserDisplay';
import { notEmpty } from '../../common/util/arrayUtil';
import { buttonHover } from '../../common/util/cssUtil';
import keyMapper from '../../common/util/keyMapper';

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
    ...buttonHover(theme),
    '&:hover $title': {
      textDecoration: 'underline',
    },
    cursor: 'pointer',
    padding: theme.spacing(2, 4),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  name: {
    marginLeft: theme.spacing(2),
  },
});
interface Props {
  server: Server;
  search?: Partial<Admin.UserSearchAdmin>;
  onUserClick: (userId: string) => void;
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
          return this.props.searchResult.users.map(user => (
            <React.Fragment key={user.userId}>
              <div
                className={this.props.classes.user}
                onClick={() => this.props.onUserClick(user.userId)}
              >
                <AvatarDisplay
                  user={user}
                />
                <UserDisplay
                  labelClassName={this.props.classes.name}
                  suppressTypography
                  suppressStar
                  variant='text'
                  user={user}
                />
              </div>
              <Divider />
            </React.Fragment>
          ));
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
