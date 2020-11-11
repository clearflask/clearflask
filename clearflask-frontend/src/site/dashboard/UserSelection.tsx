import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import * as Admin from '../../api/admin';
import { ReduxState, Server, Status } from '../../api/server';
import SelectionPicker, { Label } from '../../app/comps/SelectionPicker';
import UserDisplay from '../../common/UserDisplay';
import debounce, { SearchTypeDebounceTime } from '../../common/util/debounce';

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
  onChange?: (userLabel?: Label) => void;
  allowCreate?: boolean;
  allowClear?: boolean;
  placeholder?: string;
  helperText?: string;
  errorMsg?: string;
  width?: string | number;
  inputMinWidth?: string | number;
  alwaysOverrideWithLoggedInUser?: boolean;
}
interface ConnectProps {
  loggedInUserStatus?: Status;
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
      , SearchTypeDebounceTime);
  }

  render() {
    const seenUserIds: Set<string> = new Set();
    const options: Label[] = [];
    const selectedUserLabel = this.props.alwaysOverrideWithLoggedInUser
      ? this.props.loggedInUserLabel || this.state.selectedUserLabel
      : this.state.selectedUserLabel;

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
        placeholder={this.props.placeholder}
        helperText={this.props.helperText}
        noOptionsMessage='Type to search'
        errorMsg={!selectedUserLabel && this.props.errorMsg || undefined}
        value={selectedUserLabel ? [selectedUserLabel] : []}
        options={options}
        showClearWithOneValue={this.props.allowClear}
        width={this.props.width}
        inputMinWidth={this.props.inputMinWidth}
        disabled={this.props.disabled}
        onInputChange={(newValue, actionMeta) => {
          if (actionMeta.action === 'input-change') {
            this.searchUsers(newValue);
          }
        }}
        onValueChange={(labels, action) => {
          var selectedLabel;
          if ((action.action === 'set-value' || action.action === 'select-option')
            && labels.length === 1) {
            selectedLabel = labels[0];
          } else if (action.action === 'clear' || action.action === 'remove-value' || action.action === 'deselect-option') {
            selectedLabel = undefined;
          } else {
            return;
          }
          this.setState({ selectedUserLabel: selectedLabel })
          this.props.onChange && this.props.onChange(selectedLabel);
        }}
        formatCreateLabel={this.props.allowCreate ? inputValue => `Create '${inputValue}'` : undefined}
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
      label: (<UserDisplay user={user} variant='text' suppressTypography />),
      // label: `${user.name || 'anonymous'} ${user.email || ''}`,
      value: user.userId,
    };
    return userLabel;
  }
}

export default connect<ConnectProps, {}, Props, ReduxState>((state, ownProps) => {
  const connectProps: ConnectProps = {
    loggedInUserStatus: state.users.loggedIn.status,
    loggedInUserLabel: state.users.loggedIn.user ? UserSelection.mapUserToLabel(state.users.loggedIn.user) : undefined,
  };
  return connectProps;
})(withStyles(styles, { withTheme: true })(UserSelection));
