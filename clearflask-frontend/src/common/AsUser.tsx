import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import AdminIcon from '@material-ui/icons/SupervisorAccount';
import React from 'react';
import { connect } from 'react-redux';
import { InputActionMeta } from 'react-select/lib/types';
import * as Admin from '../api/admin';
import * as Client from '../api/client';
import { ReduxState, Server, Status } from '../api/server';
import SelectionPicker, { Label } from '../app/comps/SelectionPicker';
import notEmpty from './util/arrayUtil';
import debounce, { SearchTypeDebounceTime } from './util/debounce';

const styles = (theme: Theme) => createStyles({
  picker: {
    marginLeft: theme.spacing(2),
  },
  noUserLabel: {
    color: theme.palette.text.secondary,
  },
  adminLabel: {
    display: 'flex',
    alignItems: 'center',
    marginRight: theme.spacing(2),
  },
});
interface Props {
  server?: Server;
}
interface ConnectProps {
  loggedInUserStatus?: Status;
  loggedInUser?: Client.UserMe;
}
interface State {
  searchResult?: Admin.UserAdmin[];
}
class AsUser extends React.Component<Props & ConnectProps & WithStyles<typeof styles, true>, State> {
  state: State = {};
  readonly searchUser: (text?: string) => void;

  constructor(props) {
    super(props);
    this.state = {};
    this.searchUser = debounce(this.search.bind(this), SearchTypeDebounceTime);
    this.search();
  }

  render() {
    const noUserLabel = {
      label: (
        <span className={this.props.classes.noUserLabel}>
          Anonymous
        </span>
      ), value: '__NONE__'
    };

    const isSubmitting = this.props.loggedInUserStatus === Status.PENDING;
    const selectedUserLabel: Label = this.props.loggedInUser
      ? this.userToLabel(this.props.loggedInUser) : noUserLabel;
    var selectedUserInResults = false;
    var options = (this.state.searchResult || []).map(u => {
      if (u.userId === selectedUserLabel?.value) {
        selectedUserInResults = true;
        return null;
      }
      return this.userToLabel(u);
    }).filter(notEmpty);
    options = [
      ...(selectedUserLabel && !selectedUserInResults ? [selectedUserLabel] : []),
      ...options,
    ];

    return (
      <SelectionPicker
        disabled={!this.props.server || isSubmitting}
        className={this.props.classes.picker}
        value={[selectedUserLabel]}
        overrideDropdownIcon={null}
        options={options}
        minWidth='100px'
        onInputChange={newValue => this.searchUser(newValue)}
        onValueChange={labels => {
          const selectedUserId = labels[0]?.value;
          if (selectedUserId && this.props.server) {
            const projectId = this.props.server.getProjectId();
            this.props.server && this.props.server.dispatchAdmin().then(d => d.userLoginAdmin({
              projectId,
              userId: selectedUserId,
            }));
          }
        }}
      />
    );
  }

  userToLabel(user: Admin.UserAdmin | Admin.UserMe): Label {
    var label: string | React.ReactNode = user.name || user.email || user.userId;
    if (user.isMod) {
      label = (
        <span key={user.userId} className={this.props.classes.adminLabel}>
          <AdminIcon fontSize='inherit' />
          <span>{label}</span>
        </span>
      );
    }
    return {
      label,
      value: user.userId,
    };
  }

  search(text?: string, cursor?: string) {
    if (!this.props.server) return;
    const projectId = this.props.server.getProjectId();
    this.props.server.dispatchAdmin()
      .then(d => d.userSearchAdmin({
        projectId,
        cursor: cursor,
        userSearchAdmin: {
          searchText: text || '',
        },
      }))
      .then(result => this.setState({
        searchResult: cursor
          ? [...(this.state.searchResult || []), ...result.results]
          : result.results,
      }));
  }
}

export default connect<ConnectProps, {}, Props, ReduxState>((state: ReduxState, ownProps: Props): ConnectProps => {
  return {
    loggedInUserStatus: state.users.loggedIn.status,
    loggedInUser: state.users.loggedIn.user,
  };
})(withStyles(styles, { withTheme: true })(AsUser));
