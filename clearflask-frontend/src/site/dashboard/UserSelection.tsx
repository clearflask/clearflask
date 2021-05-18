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
  variant?: 'outlined' | 'filled' | 'standard',
  size?: 'small' | 'medium',
  disabled?: boolean;
  server: Server;
  onChange?: (userLabel?: Label) => void;
  suppressInitialOnChange?: boolean;
  allowCreate?: boolean;
  allowClear?: boolean;
  label?: string;
  placeholder?: string;
  helperText?: string;
  errorMsg?: string;
  width?: string | number;
  minWidth?: string | number;
  maxWidth?: string | number;
  alwaysOverrideWithLoggedInUser?: boolean;
  SelectionPickerProps?: Partial<React.ComponentProps<typeof SelectionPicker>>;
}
interface ConnectProps {
  loggedInUserStatus?: Status;
  loggedInUserLabel?: Label;
}
interface State {
  input?: string;
  selectedUserLabel?: Label;
  options?: Label[];
  searching?: string;
}

class UserSelection extends Component<Props & ConnectProps & WithStyles<typeof styles, true>, State> {
  readonly searchUsers: (newValue: string) => void;

  constructor(props) {
    super(props);
    const selectedUserLabel = props.loggedInUserLabel;
    this.state = { selectedUserLabel };
    if (selectedUserLabel && !props.suppressInitialOnChange) {
      this.props.onChange && this.props.onChange(selectedUserLabel);
    }
    const searchDebounced = debounce(
      (newValue: string) => this.props.server.dispatchAdmin()
        .then(d => d.userSearchAdmin({
          projectId: this.props.server.getProjectId(),
          userSearchAdmin: { searchText: newValue },
        }))
        .then(results => {
          const userLabels = results.results.map(UserSelection.mapUserToLabel);
          this.setState({
            options: userLabels,
            ...(this.state.searching === newValue ? { searching: undefined } : {}),
          });
        }).catch(e => {
          if (this.state.searching === newValue) this.setState({ searching: undefined });
        })
      , SearchTypeDebounceTime);
    this.searchUsers = newValue => {
      this.setState({ searching: newValue });
      searchDebounced(newValue);
    }
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

    if (!this.state.input && !!this.props.alwaysOverrideWithLoggedInUser && !!this.props.loggedInUserLabel && !seenUserIds.has(this.props.loggedInUserLabel.value)) {
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
        label={this.props.label}
        placeholder={this.props.placeholder}
        helperText={this.props.helperText}
        errorMsg={!selectedUserLabel && this.props.errorMsg || undefined}
        value={selectedUserLabel ? [selectedUserLabel] : []}
        options={options}
        loading={this.state.searching !== undefined}
        disableClearable={!this.props.allowClear}
        showTags
        bareTags
        disableFilter
        inputMinWidth={0}
        width={this.props.width}
        minWidth={this.props.minWidth}
        maxWidth={this.props.maxWidth}
        disabled={this.props.disabled}
        clearOnBlur
        inputValue={this.state.input || ''}
        onFocus={() => {
          if (this.state.options === undefined
            && this.state.searching === undefined
            && this.state.input === undefined) {
            this.searchUsers('');
          }
        }}
        onInputChange={(newValue, reason) => {
          this.setState({ input: newValue });
          if (reason === 'input') {
            this.searchUsers(newValue);
          }
        }}
        onValueChange={(labels) => {
          var selectedLabel: Label | undefined = labels[0];
          this.setState({
            selectedUserLabel: selectedLabel,
            input: undefined,
          })
          this.props.onChange && this.props.onChange(selectedLabel);
        }}
        formatCreateLabel={this.props.allowCreate ? inputValue => `Add user '${inputValue}'` : undefined}
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
        {...this.props.SelectionPickerProps}
        TextFieldProps={{
          variant: this.props.variant,
          size: this.props.size,
          ...this.props.SelectionPickerProps?.TextFieldProps,
        }}
      />
    );
  }

  static mapUserToLabel(user: Admin.UserAdmin | Admin.UserMe): Label {
    const userLabel: Label = {
      label: (<UserDisplay user={user} variant='text' suppressTypography maxChars={15} />),
      filterString: `${user.name || 'Anonymous'} ${user.email || ''}`,
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
