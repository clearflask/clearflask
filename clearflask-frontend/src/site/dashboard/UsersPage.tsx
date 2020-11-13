import { Button, Checkbox, Dialog, FormControlLabel, IconButton, InputAdornment, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import AddIcon from '@material-ui/icons/Add';
import AndroidIcon from '@material-ui/icons/Android';
import IosIcon from '@material-ui/icons/Apple';
import EmailIcon from '@material-ui/icons/Email';
import MoreIcon from '@material-ui/icons/MoreHoriz';
import NotificationsOffIcon from '@material-ui/icons/NotificationsOff';
import FilterIcon from '@material-ui/icons/SearchRounded';
import BrowserIcon from '@material-ui/icons/Web';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import * as Admin from '../../api/admin';
import * as Client from '../../api/client';
import { ReduxState, Server } from '../../api/server';
import ExplorerTemplate from '../../app/comps/ExplorerTemplate';
import { MaxContentWidth } from '../../app/comps/Post';
import SelectionPicker, { Label } from '../../app/comps/SelectionPicker';
import UserEdit from '../../app/comps/UserEdit';
import Loader from '../../app/utils/Loader';
import CreditView from '../../common/config/CreditView';
import SubmitButton from '../../common/SubmitButton';
import debounce, { SearchTypeDebounceTime } from '../../common/util/debounce';
import { WithMediaQuery, withMediaQuery } from '../../common/util/MediaQuery';

const searchWidth = 100;
const styles = (theme: Theme) => createStyles({
  page: {
    maxWidth: 1024,
    width: 'max-content',
  },
  searchInput: {
    margin: theme.spacing(1),
    width: searchWidth,
    // (Un)comment these to align with corner
    marginBottom: -1,
  },
  addIcon: {
    cursor: 'text',
    height: '24px',
    fontSize: '24px',
    color: theme.palette.text.hint,
  },
  nothing: {
    margin: theme.spacing(4),
    color: theme.palette.text.secondary,
    width: MaxContentWidth,
    maxWidth: '100%',
  },
  createFormFields: {
    display: 'flex',
    flexDirection: 'column',
    // (Un)comment these to align with corner
    marginTop: theme.spacing(1),
    marginRight: theme.spacing(2),
  },
  createFormField: {
    margin: theme.spacing(1),
    width: 'auto',
    flexGrow: 1,
  },
  createField: {
    minWidth: 100,
    // (Un)comment these to align with corner
    marginBottom: -1,
    marginRight: theme.spacing(3),
  },
  resultContainer: {
    margin: theme.spacing(2),
  },
  userProperties: {
    margin: theme.spacing(2),
    width: MaxContentWidth,
    maxWidth: '100%',
  },
  key: {
    margin: theme.spacing(1),
  },
  value: {
    margin: theme.spacing(1),
  },
  maxSize: {
    maxWidth: 200,
  },
});

interface Props {
  server: Server;
  onUserClick: (userId: string) => void;
}
interface ConnectProps {
  credits?: Client.Credits;
  showBalance?: boolean;
  loggedInUser?: Client.UserMe;
}
interface State {
  createRefFocused?: boolean;
  editExpandedForUserId?: string;
  newUserName?: string;
  newUserEmail?: string;
  newUserIsMod?: boolean;
  revealPassword?: boolean;
  newUserBalance?: number
  newUserIsSubmitting?: boolean;
  createFormHasExpanded?: boolean;
  searchInput?: string;
  searchText?: string;
  searchResult?: Admin.UserAdmin[];
  searchCursor?: string;
  searchOptions?: Partial<Admin.UserSearchAdmin>;
}
class UsersPage extends Component<Props & WithMediaQuery & ConnectProps & WithStyles<typeof styles, true>, State> {
  readonly updateSearchText: (name?: string, email?: string) => void;
  readonly createInputRef: React.RefObject<HTMLInputElement> = React.createRef();

  constructor(props) {
    super(props);
    this.state = {};
    this.updateSearchText = debounce(this.search.bind(this), SearchTypeDebounceTime);
    this.search();
  }

  render() {
    const expand = !!this.state.createRefFocused || !!this.state.newUserName;
    const enableSubmit = !!this.state.newUserName;

    const searchOptions = this.searchToLabels(this.state.searchOptions);

    return (
      <div className={this.props.classes.page}>
        <ExplorerTemplate
          createSize={expand ? 250 : 116}
          createShown={expand}
          createVisible={(
            <TextField
              disabled={this.state.newUserIsSubmitting}
              className={`${this.props.classes.createFormField} ${this.props.classes.createField}`}
              label='Add'
              placeholder='Name'
              value={this.state.newUserName || ''}
              onChange={e => {
                this.setState({ newUserName: e.target.value });
                this.updateSearchText(e.target.value, this.state.newUserEmail);
              }}
              InputProps={{
                inputRef: this.createInputRef,
                onBlur: () => this.setState({ createRefFocused: false }),
                onFocus: () => this.setState({ createRefFocused: true }),
                endAdornment: (
                  <InputAdornment position="end">
                    <AddIcon
                      className={this.props.classes.addIcon}
                      onClick={() => this.createInputRef.current?.focus()}
                    />
                  </InputAdornment>
                ),
              }}
            />
          )}
          createCollapsible={(
            <div className={this.props.classes.createFormFields}>
              <TextField
                disabled={this.state.newUserIsSubmitting}
                className={this.props.classes.createFormField}
                placeholder='Email'
                value={this.state.newUserEmail || ''}
                onChange={e => {
                  this.setState({ newUserEmail: e.target.value });
                  this.updateSearchText(this.state.newUserName, e.target.value);
                }}
              />
              <FormControlLabel
                label='Moderator'
                disabled={this.state.newUserIsSubmitting}
                className={this.props.classes.createFormField}
                control={(
                  <Checkbox
                    color='primary'
                    checked={!!this.state.newUserIsMod}
                    onChange={e => this.setState({ newUserIsMod: !this.state.newUserIsMod })}
                  />
                )}
              />
              <SubmitButton
                isSubmitting={this.state.newUserIsSubmitting}
                disabled={!enableSubmit}
                color='primary'
                onClick={e => {
                  if (!enableSubmit) return;
                  this.setState({ newUserIsSubmitting: true });
                  this.props.server.dispatchAdmin().then(d => d.userCreateAdmin({
                    projectId: this.props.server.getProjectId(),
                    userCreateAdmin: {
                      name: this.state.newUserName,
                      email: this.state.newUserEmail,
                      balance: this.state.newUserBalance,
                      isMod: this.state.newUserIsMod,
                    },
                  })).then(user => {
                    this.setState({
                      createRefFocused: false,
                      newUserName: undefined,
                      newUserEmail: undefined,
                      revealPassword: undefined,
                      newUserBalance: undefined,
                      newUserIsSubmitting: false,
                      searchInput: undefined,
                      searchResult: [user],
                    });
                    this.props.onUserClick(user.userId);
                  }).catch(e => this.setState({
                    newUserIsSubmitting: false,
                  }));
                }}
                style={{
                  alignSelf: 'flex-end',
                }}
              >
                Submit
              </SubmitButton>
            </div>
          )}
          searchSize={searchWidth}
          search={expand ? undefined : (
            <SelectionPicker
              className={this.props.classes.searchInput}
              placeholder='Search'
              options={searchOptions.options}
              isMulti
              group
              isInExplorer
              minWidth={100}
              maxWidth={200}
              showTags={false}
              disableFilter
              disableCloseOnSelect
              value={searchOptions.selected}
              formatHeader={inputValue => !!inputValue ? `Searching for "${inputValue}"` : `Type to search`}
              popupColumnCount={3}
              PopperProps={{ placement: 'bottom-end' }}
              onValueChange={labels => this.setState({ searchOptions: this.labelsToSearch(labels) })}
              inputValue={this.state.searchInput || ''}
              onInputChange={newValue => {
                this.setState({
                  searchInput: newValue,
                  searchText: newValue,
                });
                this.updateSearchText(newValue);
              }}
              dropdownIcon={FilterIcon}
            />
          )}
          content={(
            <div className={this.props.classes.resultContainer}>
              {this.state.searchResult && this.state.searchResult.length > 0
                ? (
                  <React.Fragment>
                    <Table size='small' className={this.props.classes.userProperties}>
                      <TableHead>
                        <TableRow>
                          <TableCell key='view'></TableCell>
                          <TableCell key='name'>Name</TableCell>
                          <TableCell key='email'>Email</TableCell>
                          {this.props.showBalance && (
                            <TableCell key='balance'>Balance</TableCell>
                          )}
                          <TableCell key='notifications'>Notifications</TableCell>
                          <TableCell key='edit'></TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {this.state.searchResult.map((user, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <IconButton key='view'
                                onClick={e => this.props.onUserClick(user.userId)}>
                                <MoreIcon />
                              </IconButton>
                            </TableCell>
                            <TableCell><Typography noWrap className={this.props.classes.maxSize}>{user.name}</Typography></TableCell>
                            <TableCell><Typography noWrap className={this.props.classes.maxSize}>{user.email}</Typography></TableCell>
                            {this.props.showBalance && (
                              <TableCell><Typography>
                                {!!user.balance && (<CreditView
                                  val={user.balance}
                                  credits={this.props.credits || { formats: [] }} />)}
                              </Typography></TableCell>
                            )}
                            <TableCell><Typography>
                              {!user.emailNotify && !user.browserPush && !user.iosPush && !user.androidPush && (<NotificationsOffIcon fontSize='inherit' />)}
                              {user.emailNotify && (<EmailIcon fontSize='inherit' />)}
                              {user.browserPush && (<BrowserIcon fontSize='inherit' />)}
                              {user.iosPush && (<IosIcon fontSize='inherit' />)}
                              {user.androidPush && (<AndroidIcon fontSize='inherit' />)}
                            </Typography></TableCell>
                            <TableCell>
                              <Button key='edit' variant='text'
                                onClick={e => this.setState({ editExpandedForUserId: user.userId })}>
                                <Typography variant='caption'>Edit</Typography>
                              </Button>
                              {this.state.editExpandedForUserId !== undefined && (
                                <Dialog
                                  open={this.state.editExpandedForUserId === user.userId}
                                  onClose={() => this.setState({ editExpandedForUserId: '' })}
                                  scroll='body'
                                  fullScreen={this.props.mediaQuery}
                                  fullWidth
                                >
                                  <UserEdit
                                    key={`edit${user.userId}`}
                                    server={this.props.server}
                                    user={user}
                                    credits={this.props.credits}
                                    isMe={this.props.loggedInUser?.userId === user.userId}
                                    isInsideDialog
                                    onUpdated={userUpdated => {
                                      const updatedSearchResult = [...this.state.searchResult!];
                                      updatedSearchResult[index] = userUpdated;
                                      this.setState({
                                        searchResult: updatedSearchResult,
                                        editExpandedForUserId: '',
                                      });
                                    }}
                                    onDeleted={() => {
                                      const updatedSearchResult = [...this.state.searchResult!];
                                      updatedSearchResult.splice(index, 1);
                                      this.setState({
                                        searchResult: updatedSearchResult,
                                        editExpandedForUserId: '',
                                      });
                                    }}
                                    onClose={() => this.setState({ editExpandedForUserId: '' })}
                                  />
                                </Dialog>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {!!this.state.searchCursor && (
                      <Button
                        style={{ margin: 'auto', display: 'block' }}
                        onClick={() => this.search(this.state.searchText, undefined, this.state.searchCursor)}
                      >
                        Show more
                      </Button>
                    )}
                  </React.Fragment>
                ) : (
                  <div className={this.props.classes.nothing}>
                    <Loader loaded={this.state.searchResult !== undefined}>
                      <Typography variant='overline'>No users found</Typography>
                    </Loader>
                  </div>
                )}
            </div>
          )}
        />
      </div>
    );
  }

  search(name?: string, email?: string, cursor?: string) {
    this.props.server.dispatchAdmin()
      .then(d => d.userSearchAdmin({
        projectId: this.props.server.getProjectId(),
        cursor: cursor,
        userSearchAdmin: {
          ...this.state.searchOptions,
          searchText: `${name || ''} ${email || ''}`.trim(),
        },
      }))
      .then(result => this.setState({
        searchResult: cursor
          ? [...(this.state.searchResult || []), ...result.results]
          : result.results,
        searchCursor: result.cursor,
      }));
  }


  searchToLabels(search?: Partial<Admin.UserSearchAdmin>): { options: Label[], selected: Label[] } {
    const result = {
      options: [] as Label[],
      selected: [] as Label[],
    };

    const modOnly: Label = {
      groupBy: 'Filter',
      label: 'Moderators',
      value: 'Mods',
    };
    result.options.push(modOnly);
    if (search?.isMod) result.selected.push(modOnly);

    const sortCreated: Label = {
      groupBy: 'Sort',
      label: 'Created',
      value: Admin.UserSearchAdminSortByEnum.Created,
    }
    result.options.push(sortCreated);
    if (search?.sortBy === Admin.UserSearchAdminSortByEnum.Created) result.selected.push(sortCreated);

    const sortFundsAvailable: Label = {
      groupBy: 'Sort',
      label: 'Balance',
      value: Admin.UserSearchAdminSortByEnum.FundsAvailable,
    }
    result.options.push(sortFundsAvailable);
    if (search?.sortBy === Admin.UserSearchAdminSortByEnum.FundsAvailable) result.selected.push(sortFundsAvailable);

    const orderAsc: Label = {
      groupBy: 'Order',
      label: 'Ascending',
      value: Admin.UserSearchAdminSortOrderEnum.Asc,
    }
    result.options.push(orderAsc);
    if (search?.sortOrder === Admin.UserSearchAdminSortOrderEnum.Asc) result.selected.push(orderAsc);

    const orderDesc: Label = {
      groupBy: 'Order',
      label: 'Descending',
      value: Admin.UserSearchAdminSortOrderEnum.Desc,
    }
    result.options.push(orderDesc);
    if (search?.sortOrder === Admin.UserSearchAdminSortOrderEnum.Desc) result.selected.push(orderDesc);

    return result;
  }

  labelsToSearch(labels: Label[]): Partial<Admin.UserSearchAdmin> {
    const search: Partial<Admin.UserSearchAdmin> = {};
    labels.forEach(label => {
      if (label.groupBy === 'Filter') {
        if (label.value === 'Mods') search.isMod = true;
      }
      if (label.groupBy === 'Sort') {
        if (label.value === Admin.UserSearchAdminSortByEnum.Created) search.sortBy = Admin.UserSearchAdminSortByEnum.Created;
        if (label.value === Admin.UserSearchAdminSortByEnum.FundsAvailable) search.sortBy = Admin.UserSearchAdminSortByEnum.FundsAvailable;
      }
      if (label.groupBy === 'Order') {
        if (label.value === Admin.UserSearchAdminSortOrderEnum.Asc) search.sortOrder = Admin.UserSearchAdminSortOrderEnum.Asc;
        if (label.value === Admin.UserSearchAdminSortOrderEnum.Desc) search.sortOrder = Admin.UserSearchAdminSortOrderEnum.Desc;
      }
    });
    return search;
  }
}

export default connect<ConnectProps, {}, Props, ReduxState>((state: ReduxState, ownProps: Props): ConnectProps => {
  const connectProps: ConnectProps = {
    credits: state.conf.conf?.users.credits,
    showBalance: !!state.conf.conf?.users.credits,
    loggedInUser: state.users.loggedIn.user,
  };
  return connectProps;
})(withStyles(styles, { withTheme: true })(
  withMediaQuery(theme => theme.breakpoints.down('xs'))(UsersPage)));
