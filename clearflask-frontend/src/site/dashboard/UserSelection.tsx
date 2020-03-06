import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import * as Admin from '../../api/admin';
import { ReduxState, Server } from '../../api/server';
import SelectionPicker, { Label } from '../../app/comps/SelectionPicker';
import debounce from '../../common/util/debounce';

const styles = (theme: Theme) => createStyles({
  createFormField: {
    margin: theme.spacing(1),
    width: 'auto',
    flexGrow: 1,
  },
});

interface Props {
  className?: string;
  disabled?: boolean;
  server: Server;
  onChange?: (userLabel: Label) => void;
  allowCreate?: boolean;
}
interface ConnectProps {
  loggedInUserLabel?: Label;
}
interface State {
  selectedUserLabel?: Label;
  options?: Label[];
}

class UserSelection extends Component<Props & ConnectProps & WithStyles<typeof styles, true>, State> {
  readonly searchUsers: (newValue: string) => void;

  constructor(props) {
    super(props);
    const selectedUserLabel = props.loggedInUserLabel;
    this.state = { selectedUserLabel };
    if (selectedUserLabel && this.props.onChange) this.props.onChange(selectedUserLabel);
    this.searchUsers = debounce(
      (newValue: string) => this.props.server.dispatchAdmin()
        .then(d => d.userSearchAdmin({
          projectId: this.props.server.getProjectId(),
          userSearchAdmin: { searchText: newValue },
        }))
        .then(results => {
          const userLabels = results.results.map(UserSelection.mapUserToLabel);
          this.setState({ options: userLabels });
        })
      , 200);
  }

  render() {
    const seenUserIds: Set<string> = new Set();
    const options: Label[] = [];

    if (!!this.state.selectedUserLabel) {
      seenUserIds.add(this.state.selectedUserLabel.value);
      options.push(this.state.selectedUserLabel);
    }

    if (!!this.props.loggedInUserLabel && !seenUserIds.has(this.props.loggedInUserLabel.value)) {
      seenUserIds.add(this.props.loggedInUserLabel.value);
      options.push(this.props.loggedInUserLabel);
    }

    this.state.options && this.state.options.forEach(option => {
      if (!seenUserIds.has(option.value)) {
        seenUserIds.add(option.value);
        options.push(option);
      }
    });

    return (
      <SelectionPicker
        className={this.props.className}
        placeholder='Author'
        errorMsg={!this.state.selectedUserLabel ? 'Select author' : undefined}
        value={this.state.selectedUserLabel ? [this.state.selectedUserLabel] : []}
        options={options}
        width='100%'
        disabled={this.props.disabled}
        onInputChange={(newValue, actionMeta) => {
          if (actionMeta.action === 'input-change') {
            this.searchUsers(newValue);
          }
        }}
        onValueChange={(labels, action) => {
          if (action.action !== 'set-value' || labels.length !== 1) return;
          this.setState({ selectedUserLabel: labels[0] })
          this.props.onChange && this.props.onChange(labels[0]);
        }}
        onValueCreate={this.props.allowCreate ? name => {
          this.props.server.dispatchAdmin()
            .then(d => d.userCreateAdmin({
              projectId: this.props.server.getProjectId(),
              userCreateAdmin: { name },
            }))
            .then(user => {
              const newLabel = UserSelection.mapUserToLabel(user);
              this.setState({ selectedUserLabel: newLabel });
              this.props.onChange && this.props.onChange(newLabel);
            });
        } : undefined}
      />
    );
  }

  static mapUserToLabel(user: Admin.UserAdmin | Admin.UserMe): Label {
    const userLabel: Label = {
      label: `${user.name || 'anonymous'} ${user.email || ''}`,
      value: user.userId,
    };
    return userLabel;
  }
}

export default connect<ConnectProps, {}, Props, ReduxState>((state, ownProps) => {
  const connectProps: ConnectProps = {
    loggedInUserLabel: state.users.loggedIn.user ? UserSelection.mapUserToLabel(state.users.loggedIn.user) : undefined,
  };
  return connectProps;
})(withStyles(styles, { withTheme: true })(UserSelection));
