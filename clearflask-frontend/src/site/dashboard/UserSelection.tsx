// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import * as Admin from '../../api/admin';
import * as Client from '../../api/admin';
import { ReduxState, Server, Status } from '../../api/server';
import SelectionPicker, { Label } from '../../app/comps/SelectionPicker';
import UserWithAvatarDisplay from '../../common/UserWithAvatarDisplay';
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
  initialUserId?: string;
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
  SelectionPickerProps?: Partial<React.ComponentProps<typeof SelectionPicker>>;
  LabelProps?: Partial<React.ComponentProps<typeof UserWithAvatarDisplay>>;
}
interface ConnectProps {
  loggedInUserStatus?: Status;
  loggedInUserLabel?: Label;
  initialUserLabel?: Label;
  callOnMount?: () => void,
}
interface State {
  input?: string;
  selectedUserLabel?: Label;
  options?: Label[];
  searching?: string;
}

class UserSelection extends Component<Props & ConnectProps & WithStyles<typeof styles, true>, State> {
  state: State = {};
  readonly searchUsers: (newValue: string) => void;
  initialOnChangeEmitted: boolean;

  constructor(props) {
    super(props);

    this.props.callOnMount?.();

    this.initialOnChangeEmitted = !!this.props.suppressInitialOnChange;

    const searchDebounced = debounce(
      (newValue: string) => this.props.server.dispatchAdmin()
        .then(d => d.userSearchAdmin({
          projectId: this.props.server.getProjectId(),
          userSearchAdmin: { searchText: newValue },
        }))
        .then(results => {
          const userLabels = results.results.map(user => UserSelection.mapUserToLabel(user, this.props.LabelProps));
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

    const selectedUserLabel = this.state.selectedUserLabel || this.props.initialUserLabel;
    if (!!selectedUserLabel && !this.initialOnChangeEmitted) {
      this.initialOnChangeEmitted = true;
      this.props.onChange?.(selectedUserLabel);
    }

    if (!!selectedUserLabel) {
      seenUserIds.add(selectedUserLabel.value);
      options.push(selectedUserLabel);
    }

    if (!this.state.input && !!this.props.loggedInUserLabel && !seenUserIds.has(this.props.loggedInUserLabel.value)) {
      seenUserIds.add(this.props.loggedInUserLabel.value);
      options.push(this.props.loggedInUserLabel);
    }

    const isSearching = this.state.searching !== undefined;
    !isSearching && this.state.options?.forEach(option => {
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
        formatHeader={inputValue => !inputValue && `Type to search${this.props.allowCreate ? '/create' : ''}`}
        options={options}
        loading={isSearching}
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
        formatCreateLabel={(this.props.allowCreate && !isSearching) ? inputValue => `Add user '${inputValue}'` : undefined}
        onValueCreate={(this.props.allowCreate && !isSearching) ? name => {
          this.props.server.dispatchAdmin()
            .then(d => d.userCreateAdmin({
              projectId: this.props.server.getProjectId(),
              userCreateAdmin: { name },
            }))
            .then(user => {
              const newLabel = UserSelection.mapUserToLabel(user, this.props.LabelProps);
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

  static mapUserToLabel(
    user: Admin.UserAdmin | Admin.UserMe | Client.User,
    LabelProps?: Partial<React.ComponentProps<typeof UserWithAvatarDisplay>>,
  ): Label {
    const userLabel: Label = {
      label: (<UserWithAvatarDisplay user={user} maxChars={15} {...LabelProps} />),
      filterString: `${user.name || 'Anonymous'} ${user['email'] || ''}`,
      value: user.userId,
    };
    return userLabel;
  }
}

export default connect<ConnectProps, {}, Props, ReduxState>((state, ownProps) => {
  var callOnMount;
  var initialUserLabel: Label | undefined;
  if (ownProps.initialUserId) {
    const initialUserId = ownProps.initialUserId;
    const initialUser = state.users.byId[ownProps.initialUserId]?.user;
    if (!initialUser) {
      callOnMount = () => {
        ownProps.server.dispatch().then(d => d.userGet({
          projectId: ownProps.server.getProjectId(),
          userId: initialUserId,
        }));
      };
    } else {
      initialUserLabel = UserSelection.mapUserToLabel(initialUser, ownProps.LabelProps);
    }
  }

  const connectProps: ConnectProps = {
    callOnMount,
    loggedInUserStatus: state.users.loggedIn.status,
    loggedInUserLabel: state.users.loggedIn.user ? UserSelection.mapUserToLabel(state.users.loggedIn.user, ownProps.LabelProps) : undefined,
    initialUserLabel,
  };
  return connectProps;
})(withStyles(styles, { withTheme: true })(UserSelection));
