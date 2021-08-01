// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { Button, Checkbox, FormControlLabel, InputAdornment, Table, TableBody, TableCell, TableRow, TextField, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import AddIcon from '@material-ui/icons/Add';
import AndroidIcon from '@material-ui/icons/Android';
import IosIcon from '@material-ui/icons/Apple';
import EmailIcon from '@material-ui/icons/Email';
import NotificationsOffIcon from '@material-ui/icons/NotificationsOff';
import FilterIcon from '@material-ui/icons/TuneSharp';
import BrowserIcon from '@material-ui/icons/Web';
import classNames from 'classnames';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import TruncateEllipsis from 'react-truncate-markup';
import * as Admin from '../../api/admin';
import * as Client from '../../api/client';
import { ReduxState, Server } from '../../api/server';
import ExplorerTemplate from '../../app/comps/ExplorerTemplate';
import { MaxContentWidth } from '../../app/comps/Post';
import SelectionPicker from '../../app/comps/SelectionPicker';
import Loader from '../../app/utils/Loader';
import CreditView from '../../common/config/CreditView';
import { contentScrollApplyStyles, Orientation } from '../../common/ContentScroll';
import { userLabelsToSearch, userSearchToLabels } from '../../common/search/searchUtil';
import SubmitButton from '../../common/SubmitButton';
import UserDisplay from '../../common/UserDisplay';
import debounce, { SearchTypeDebounceTime } from '../../common/util/debounce';
import { WithMediaQuery, withMediaQuery } from '../../common/util/MediaQuery';

const searchWidth = 100;
const styles = (theme: Theme) => createStyles({
  searchInput: {
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
    width: (props: Props) => props.nameOnly ? 200 : MaxContentWidth,
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
  },
  table: {
    width: (props: Props) => props.nameOnly ? 200 : undefined,
    maxWidth: '100%',
  },
  tableHideDividers: {
    '& .MuiTableCell-root': {
      borderBottom: 'none !important',
    },
  },
  key: {
    margin: theme.spacing(1),
  },
  value: {
    margin: theme.spacing(1),
  },
  link: {
  },
  row: {
    verticalAlign: 'baseline',
    cursor: 'pointer',
    textDecoration: 'none',
    '&:hover $link': {
      textDecoration: 'underline',
    },
  },
  title: {
    margin: theme.spacing(1),
    color: theme.palette.text.secondary,
  },
  scroll: {
    ...contentScrollApplyStyles({ theme, orientation: Orientation.Vertical }),
  },
});

interface Props {
  className?: string;
  server: Server;
  isDashboard?: boolean;
  showCreate?: boolean;
  showFilter?: boolean;
  nameOnly?: boolean;
  onUserClick: (userId: string) => void;
  title?: string;
  titleSize?: number | string;
  hideShowMore?: boolean;
  onResults?: (results: Admin.UserSearchResponse) => void;
}
interface ConnectProps {
  credits?: Client.Credits;
  showBalance?: boolean;
  loggedInUser?: Client.UserMe;
  maxContentHeight?: number | string;
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
class UserExplorer extends Component<Props & WithMediaQuery & ConnectProps & WithStyles<typeof styles, true>, State> {
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

    const searchOptions = userSearchToLabels(this.state.searchOptions);

    var content = (
      <div className={this.props.classes.resultContainer}>
        {this.state.searchResult && this.state.searchResult.length > 0
          ? (
            <>
              <Table
                className={classNames(this.props.classes.table, !!this.props.nameOnly && this.props.classes.tableHideDividers)}
              >
                <TableBody>
                  {this.state.searchResult.map((user, index) => (
                    <TableRow
                      key={index}
                      className={this.props.classes.row}
                      onClick={e => this.props.onUserClick(user.userId)}
                    >
                      <TableCell><Typography>
                        <UserDisplay
                          variant='text'
                          maxChars={20}
                          user={user}
                          suppressTypography
                        />
                      </Typography></TableCell>
                      {!this.props.nameOnly && (
                        <>
                          <TableCell>
                            <TruncateEllipsis ellipsis='…' lines={1}>
                              <Typography>{user.email}</Typography>
                            </TruncateEllipsis>
                          </TableCell>
                          <TableCell><Typography>
                            {!user.emailNotify && !user.browserPush && !user.iosPush && !user.androidPush && (<NotificationsOffIcon fontSize='inherit' />)}
                            {user.emailNotify && (<EmailIcon fontSize='inherit' />)}
                            {user.browserPush && (<BrowserIcon fontSize='inherit' />)}
                            {user.iosPush && (<IosIcon fontSize='inherit' />)}
                            {user.androidPush && (<AndroidIcon fontSize='inherit' />)}
                          </Typography></TableCell>
                          {this.props.showBalance && (
                            <TableCell><Typography>
                              {!!user.balance && (<CreditView
                                val={user.balance}
                                credits={this.props.credits || { formats: [] }} />)}
                            </Typography></TableCell>
                          )}
                        </>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {!!this.state.searchCursor && !this.props.hideShowMore && (
                <Button
                  style={{ margin: 'auto', display: 'block' }}
                  onClick={() => this.search(this.state.searchText, undefined, this.state.searchCursor)}
                >
                  Show more
                </Button>
              )}
            </>
          ) : (
            <div className={this.props.classes.nothing}>
              <Loader loaded={this.state.searchResult !== undefined}>
                <Typography variant='overline'>No users found</Typography>
              </Loader>
            </div>
          )}
      </div>
    );

    if (this.props.maxContentHeight) {
      content = (
        <div className={this.props.classes.scroll} style={{ maxHeight: this.props.maxContentHeight }}>
          {content}
        </div>
      );
    }

    return (
      <ExplorerTemplate
        className={this.props.className}
        isDashboard={this.props.isDashboard}
        createSize={!this.props.showCreate ? this.props.titleSize : (expand ? 250 : 116)}
        createShown={!this.props.showCreate ? undefined : expand}
        createVisible={!this.props.showCreate ? (this.props.title ? (<Typography className={this.props.classes.title}>{this.props.title}</Typography>) : undefined) : (
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
        createCollapsible={!this.props.showCreate ? undefined : (
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
        search={(!this.props.showFilter || expand) ? undefined : (
          <SelectionPicker
            className={this.props.classes.searchInput}
            placeholder='Filter'
            options={searchOptions.options}
            isMulti
            group
            isInExplorer
            showTags={false}
            disableFilter
            disableCloseOnSelect
            disableClearOnValueChange
            value={searchOptions.selected}
            formatHeader={inputValue => !!inputValue ? `Searching for "${inputValue}"` : `Type to search`}
            popupColumnCount={3}
            PopperProps={{ placement: 'bottom-end' }}
            onValueChange={labels => {
              this.setState({ searchOptions: userLabelsToSearch(labels) });
              this.updateSearchText(this.state.searchText);
            }}
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
        content={content}
      />
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
      .then(result => {
        this.setState({
          searchResult: cursor
            ? [...(this.state.searchResult || []), ...result.results]
            : result.results,
          searchCursor: result.cursor,
        });
        this.props.onResults && this.props.onResults(result);
      });
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
  withMediaQuery(theme => theme.breakpoints.down('xs'))(UserExplorer)));
