// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { Button, Collapse, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControlLabel, FormHelperText, Grid, IconButton, InputAdornment, Switch, TextField, Tooltip, Typography, CircularProgress, Box } from '@material-ui/core';
import { Theme, WithStyles, createStyles, withStyles } from '@material-ui/core/styles';
import EditIcon from '@material-ui/icons/Edit';
import VisibilityIcon from '@material-ui/icons/Visibility';
import VisibilityOffIcon from '@material-ui/icons/VisibilityOff';
import CloudUploadIcon from '@material-ui/icons/CloudUpload';
import DeleteIcon from '@material-ui/icons/Delete';
import { Alert } from '@material-ui/lab';
import classNames from 'classnames';
import { WithSnackbarProps, withSnackbar } from 'notistack';
import React, { Component } from 'react';
import { WithTranslation, withTranslation } from 'react-i18next';
import { connect } from 'react-redux';
import * as Admin from '../../api/admin';
import * as Client from '../../api/client';
import { ReduxState, Server, Status } from '../../api/server';
import AvatarDisplay from '../../common/AvatarDisplay';
import { DisplayUserName } from '../../common/UserDisplay';
import CreditView from '../../common/config/CreditView';
import WebNotification, { Status as WebNotificationStatus } from '../../common/notification/webNotification';
import { WithMediaQuery, withMediaQuery } from '../../common/util/MediaQuery';
import { truncateWithElipsis } from '../../common/util/stringUtil';
import LoadingPage from '../LoadingPage';
import TimeAgoI18n from '../utils/TimeAgoI18n';
import { PanelTitle } from './Panel';

const styles = (theme: Theme) => createStyles({
  settings: {
    minWidth: 400,
    display: 'flex',
    flexDirection: 'column',
  },
  title: {
    minWidth: '100%',
    margin: theme.spacing(0, 5),
  },
  section: {
    flex: '1 1 auto',
    margin: theme.spacing(4, 1, 4),
    maxWidth: 500,
  },
  item: {
    marginTop: theme.spacing(2),
    marginLeft: theme.spacing(4),
  },
  itemControls: {
    display: 'flex',
    alignItems: 'center',
  },
  linkGetMore: {
    marginLeft: theme.spacing(1),
    display: 'flex',
    minWidth: 'max-content',
  },
  avatarContainer: {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'flex-start',
    gap: theme.spacing(1),
  },
  uploadIconButton: {
    padding: 0,
    '&:hover': {
      backgroundColor: 'transparent',
    },
  },
  uploadIcon: {
    fontSize: 24,
    color: theme.palette.text.secondary,
  },
  deleteIconButton: {
    padding: 0,
    '&:hover': {
      backgroundColor: 'transparent',
    },
  },
  deleteIcon: {
    fontSize: 24,
    color: theme.palette.error.main,
  },
  hiddenInput: {
    display: 'none',
  },
  profilePicPreview: {
    width: 150,
    height: 150,
    borderRadius: '50%',
    objectFit: 'cover',
    marginBottom: theme.spacing(2),
  },
  avatarPreviewContainer: {
    marginBottom: theme.spacing(2),
    // Target the badge wrapper that contains the moderator star
    '& > span > span:last-child': {
      borderRadius: '50% !important',
    },
  },
  uploadArea: {
    border: `2px dashed ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(3),
    textAlign: 'center',
    cursor: 'pointer',
    transition: theme.transitions.create(['border-color', 'background-color']),
    '&:hover': {
      borderColor: theme.palette.primary.main,
      backgroundColor: theme.palette.action.hover,
    },
  },
  uploadAreaDragActive: {
    borderColor: theme.palette.primary.main,
    backgroundColor: theme.palette.action.selected,
  },
});
interface Props {
  className?: string;
  server: Server;
  /** If empty, create form is shown */
  userId?: string;
  suppressSignOut?: boolean;
  onDeleted?: () => void;
}
interface ConnectProps {
  configver?: string;
  config?: Client.Config;
  loggedInUser?: Client.UserMe;
  loggedInUserBalance?: number;
  user?: Client.User;
  categories?: Client.Category[];
  credits?: Client.Credits;
}
interface State {
  createdUserId?: string;
  userAdmin?: Admin.UserAdmin;
  userAdminStatus?: Status;
  deleteDialogOpen?: boolean;
  displayName?: string;
  email?: string;
  password?: string;
  revealPassword?: boolean;
  signoutWarnNoEmail?: boolean;
  isMod?: boolean;
  transactionCreateOpen?: boolean;
  balanceAdjustment?: string;
  balanceDescription?: string;
  profilePicDialogOpen?: boolean;
  profilePicFile?: File;
  profilePicPreview?: string;
  profilePicUploading?: boolean;
  profilePicDragActive?: boolean;
}
class UserEdit extends Component<Props & ConnectProps & WithTranslation<'app'> & WithMediaQuery & WithStyles<typeof styles, true> & WithSnackbarProps, State> {
  state: State = {};
  userAdminFetchedForUserId: string | undefined;

  render() {
    const userId = this.props.userId || this.state.createdUserId;

    const isMe = !!this.props.loggedInUser && this.props.loggedInUser.userId === userId;
    const isModOrAdminLoggedIn = this.props.server.isModOrAdminLoggedIn();

    var content;
    if (!userId) {
      // Create form
      if (!isModOrAdminLoggedIn) return null;
      content = (
        <div key='create-form' className={this.props.classes.section}>
          <PanelTitle text={this.props.t('create-user')} />
          <Grid container alignItems='center' className={this.props.classes.item}>
            <Grid item xs={12} sm={6}><Typography>{this.props.t('avatar')}</Typography></Grid>
            <Grid item xs={12} sm={6} className={this.props.classes.itemControls}>
              <AvatarDisplay user={{
                name: this.state.displayName || '',
              }} size={40} />
            </Grid>
          </Grid>
          <Grid container alignItems='center' className={this.props.classes.item}>
            <Grid item xs={12} sm={6}><Typography>{this.props.t('displayname')}</Typography></Grid>
            <Grid item xs={12} sm={6} className={this.props.classes.itemControls}>
              <TextField
                value={this.state.displayName || ''}
                onChange={e => this.setState({ displayName: e.target.value })}
              />
              <Button aria-label="Create" color='primary' style={{
                visibility:
                  !this.state.displayName ? 'hidden' : undefined
              }} onClick={async () => {
                if (!this.state.displayName || !isModOrAdminLoggedIn) {
                  return;
                }
                const newUserAdmin = await (await this.props.server.dispatchAdmin()).userCreateAdmin({
                  projectId: this.props.server.getProjectId(),
                  userCreateAdmin: { name: this.state.displayName },
                });
                this.setState({
                  createdUserId: newUserAdmin.userId,
                  userAdmin: newUserAdmin,
                  displayName: undefined,
                });
              }}>{this.props.t('save')}</Button>
            </Grid>
          </Grid>
        </div>
      );
    } else if (!isModOrAdminLoggedIn && !isMe) {
      // View only
      content = (
        <div key='view-only' className={this.props.classes.section}>
          <PanelTitle text={this.props.t('info')} />
          <Grid container alignItems='center' className={this.props.classes.item}>
            <Grid item xs={12} sm={6}><Typography>{this.props.t('avatar')}</Typography></Grid>
            <Grid item xs={12} sm={6} className={this.props.classes.itemControls}>
              <AvatarDisplay user={this.props.user} size={40} />
            </Grid>
          </Grid>
          <Grid container alignItems='center' className={this.props.classes.item}>
            <Grid item xs={12} sm={6}><Typography>{this.props.t('displayname')}</Typography></Grid>
            <Grid item xs={12} sm={6} className={this.props.classes.itemControls}>
              {DisplayUserName(this.props.user)}
            </Grid>
          </Grid>
          <Grid container alignItems='center' className={this.props.classes.item}>
            <Grid item xs={12} sm={6}><Typography>{this.props.t('registered')}</Typography></Grid>
            <Grid item xs={12} sm={6} className={this.props.classes.itemControls}>
              <TimeAgoI18n date={this.props.user?.created || 0} />
            </Grid>
          </Grid>
        </div>
      );
    } else {
      // Edit form (for both self and by admin/mod)
      var user: Client.UserMe | Admin.UserAdmin | undefined;
      var balance: number | undefined;
      if (this.props.loggedInUser?.userId === userId) {
        user = this.props.loggedInUser;
        balance = this.props.loggedInUserBalance;
      } else {
        user = this.state.userAdmin;
        balance = this.state.userAdmin?.balance;
        if (this.userAdminFetchedForUserId !== userId) {
          this.userAdminFetchedForUserId = userId;
          this.props.server.dispatchAdmin().then(d => d.userGetAdmin({
            projectId: this.props.server.getProjectId(),
            userId,
          }))
            .then(userAdmin => this.setState({
              userAdmin,
              userAdminStatus: Status.FULFILLED,
            }))
            .catch(e => this.setState({
              userAdminStatus: Status.REJECTED,
            }));
        }
      }

      if (!user) {
        return (<LoadingPage />);
      }

      const balanceAdjustmentHasError = !!this.state.balanceAdjustment && (!parseInt(this.state.balanceAdjustment) || !+this.state.balanceAdjustment || parseInt(this.state.balanceAdjustment) !== parseFloat(this.state.balanceAdjustment));

      const browserPushControl = this.renderBrowserPushControl(isMe, user);
      // const androidPushControl = this.renderMobilePushControl(MobileNotificationDevice.Android);
      // const iosPushControl = this.renderMobilePushControl(MobileNotificationDevice.Ios);
      const emailControl = this.renderEmailControl(isMe, user);

      const isPushOrAnon = !user.email && !user.isExternal;

      const categoriesWithSubscribe = (this.props.categories || []).filter(c => !!c.subscription);

      content = (
        <React.Fragment key='edit-user'>
          <div className={this.props.classes.section}>
            <PanelTitle text={this.props.t('account')} />
            <Grid container alignItems='center' className={this.props.classes.item}>
              <Grid item xs={12} sm={6}><Typography>{this.props.t('avatar')}</Typography></Grid>
              <Grid item xs={12} sm={6} className={this.props.classes.itemControls}>
                <div className={this.props.classes.avatarContainer}>
                  <AvatarDisplay user={{
                    ...user,
                    ...(this.state.displayName !== undefined ? {
                      name: this.state.displayName,
                    } : {}),
                    ...(this.state.email !== undefined ? {
                      email: this.state.email,
                    } : {}),
                  }} size={40} />
                  {this.renderProfilePicActions(user, userId!, isModOrAdminLoggedIn)}
                </div>
              </Grid>
            </Grid>
            <Grid container alignItems='center' className={this.props.classes.item}>
              <Grid item xs={12} sm={6}><Typography>{this.props.t('displayname')}</Typography></Grid>
              <Grid item xs={12} sm={6} className={this.props.classes.itemControls}>
                <TextField
                  id='displayName'
                  error={!user.name}
                  value={(this.state.displayName === undefined ? user.name : this.state.displayName) || ''}
                  onChange={e => this.setState({ displayName: e.target.value })}
                />
                <Button aria-label={this.props.t('save')} color='primary' style={{
                  visibility:
                    !this.state.displayName
                      || this.state.displayName === user.name
                      ? 'hidden' : undefined
                }} onClick={async () => {
                  if (!this.state.displayName
                    || !user
                    || this.state.displayName === user.name) {
                    return;
                  }
                  if (isModOrAdminLoggedIn) {
                    const newUserAdmin = await (await this.props.server.dispatchAdmin()).userUpdateAdmin({
                      projectId: this.props.server.getProjectId(),
                      userId: userId!,
                      userUpdateAdmin: { name: this.state.displayName },
                    });
                    this.setState({ displayName: undefined, userAdmin: newUserAdmin });
                  } else {
                    await (await this.props.server.dispatch()).userUpdate({
                      projectId: this.props.server.getProjectId(),
                      userId: userId!,
                      userUpdate: { name: this.state.displayName },
                    });
                    this.setState({ displayName: undefined });
                  }
                }}>{this.props.t('save')}</Button>
              </Grid>
            </Grid>
            <Grid container alignItems='center' className={this.props.classes.item}>
              <Grid item xs={12} sm={6}><Typography>{this.props.t('email')}</Typography></Grid>
              <Grid item xs={12} sm={6} className={this.props.classes.itemControls}>
                {!!user.isExternal ? (
                  <Tooltip title={this.props.t('cannot-be-changed')} placement='top-start'>
                    <Typography>{user.email || this.props.t('none')}</Typography>
                  </Tooltip>
                ) : (
                  <>
                    <TextField
                      id='email'
                      value={(this.state.email === undefined ? user.email : this.state.email) || ''}
                      onChange={e => this.setState({ email: e.target.value })}
                      autoFocus={!!this.state.createdUserId}
                    />
                    <Button aria-label={this.props.t('save')} color='primary' style={{
                      visibility:
                        !this.state.email
                          || this.state.email === user.email
                          ? 'hidden' : undefined
                    }} onClick={async () => {
                      if (!this.state.email
                        || !user
                        || this.state.email === user.email) {
                        return;
                      }
                      if (isModOrAdminLoggedIn) {
                        const newUserAdmin = await (await this.props.server.dispatchAdmin()).userUpdateAdmin({
                          projectId: this.props.server.getProjectId(),
                          userId: userId!,
                          userUpdateAdmin: { email: this.state.email },
                        });
                        this.setState({ email: undefined, userAdmin: newUserAdmin });
                      } else {
                        await (await this.props.server.dispatch()).userUpdate({
                          projectId: this.props.server.getProjectId(),
                          userId: userId!,
                          userUpdate: { email: this.state.email },
                        });
                        this.setState({ email: undefined });
                      }
                    }}>{this.props.t('save')}</Button>
                  </>
                )}
              </Grid>
            </Grid>
            {!user.isExternal && (
              <Grid container alignItems='center' className={this.props.classes.item}>
                <Grid item xs={12} sm={6}><Typography>{this.props.t('password-0')}</Typography></Grid>
                <Grid item xs={12} sm={6} className={this.props.classes.itemControls}>
                  <TextField
                    id='password'
                    value={this.state.password || ''}
                    onChange={e => this.setState({ password: e.target.value })}
                    type={this.state.revealPassword ? 'text' : 'password'}
                    disabled={!this.state.email && !user.email}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position='end'>
                          <IconButton
                            aria-label='Toggle password visibility'
                            onClick={() => this.setState({ revealPassword: !this.state.revealPassword })}
                            disabled={!this.state.email && !user.email}
                          >
                            {this.state.revealPassword ? <VisibilityIcon fontSize='small' /> : <VisibilityOffIcon fontSize='small' />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                  <Button aria-label={this.props.t('save')} color='primary' style={{
                    visibility:
                      !this.state.password
                        || this.state.password === user.name
                        ? 'hidden' : undefined
                  }} onClick={async () => {
                    if (!this.state.password
                      || !user) {
                      return;
                    }
                    if (isModOrAdminLoggedIn) {
                      const newUserAdmin = await (await this.props.server.dispatchAdmin()).userUpdateAdmin({
                        projectId: this.props.server.getProjectId(),
                        userId: userId!,
                        userUpdateAdmin: { password: this.state.password },
                      });
                      this.setState({ password: undefined, userAdmin: newUserAdmin });
                    } else {
                      await (await this.props.server.dispatch()).userUpdate({
                        projectId: this.props.server.getProjectId(),
                        userId: userId!,
                        userUpdate: { password: this.state.password },
                      });
                      this.setState({ password: undefined });
                    }
                  }}>{this.props.t('save')}</Button>
                </Grid>
              </Grid>
            )}
            {this.props.credits && (
              <Grid container alignItems='center' className={this.props.classes.item}>
                <Grid item xs={12} sm={6}><Typography>{this.props.t('balance')}</Typography></Grid>
                <Grid item xs={12} sm={6} className={this.props.classes.itemControls}>
                  <CreditView val={balance || 0} credits={this.props.credits} />
                  {isMe && !!this.props.credits?.creditPurchase?.redirectUrl && (
                    <Button
                      component={'a' as any}
                      className={this.props.classes.linkGetMore}
                      color='primary'
                      href={this.props.credits.creditPurchase.redirectUrl}
                      target='_blank'
                      underline='none'
                      rel='noopener nofollow'
                    >
                      {this.props.credits.creditPurchase.buttonTitle || 'Get more'}
                    </Button>
                  )}
                  {isModOrAdminLoggedIn && (
                    <>
                      <IconButton onClick={() => this.setState({ transactionCreateOpen: !this.state.transactionCreateOpen })}>
                        <EditIcon />
                      </IconButton>
                      <Collapse in={this.state.transactionCreateOpen}>
                        <div>
                          <TextField
                            label='Adjustment amount'
                            value={this.state.balanceAdjustment || ''}
                            error={balanceAdjustmentHasError}
                            helperText={balanceAdjustmentHasError ? 'Invalid number' : (
                              !this.state.balanceAdjustment ? undefined : (
                                <CreditView
                                  val={+this.state.balanceAdjustment}
                                  credits={this.props.credits}
                                />
                              ))}
                            onChange={e => this.setState({ balanceAdjustment: e.target.value })}
                          />
                          <TextField
                            label='Transaction note'
                            value={this.state.balanceDescription || ''}
                            onChange={e => this.setState({ balanceDescription: e.target.value })}
                          />
                          <Button aria-label="Save" color='primary' style={{
                            visibility:
                              (this.state.balanceAdjustment || 0) === 0
                                ? 'hidden' : undefined
                          }} onClick={async () => {
                            if (this.state.balanceAdjustment === undefined
                              || +this.state.balanceAdjustment === 0
                              || !user) {
                              return;
                            }
                            const dispatcher = await this.props.server.dispatchAdmin();
                            const newUserAdmin = await dispatcher.userUpdateAdmin({
                              projectId: this.props.server.getProjectId(),
                              userId: userId!,
                              userUpdateAdmin: {
                                transactionCreate: {
                                  amount: +this.state.balanceAdjustment,
                                  summary: this.state.balanceDescription,
                                }
                              },
                            });
                            this.setState({
                              userAdmin: newUserAdmin,
                              transactionCreateOpen: false,
                              balanceAdjustment: undefined,
                              balanceDescription: undefined,
                            });
                          }}>Save</Button>
                        </div>
                      </Collapse>
                    </>
                  )}
                </Grid>
              </Grid>
            )}
            {isModOrAdminLoggedIn && (
              <>
                <Grid container alignItems='center' className={this.props.classes.item}>
                  <Grid item xs={12} sm={6}><Typography>{this.props.t('is-moderator')}</Typography></Grid>
                  <Grid item xs={12} sm={6} className={this.props.classes.itemControls}>
                    <FormControlLabel
                      control={(
                        <Switch
                          color='default'
                          checked={!!user.isMod}
                          onChange={async (e, checked) => {
                            const dispatcher = await this.props.server.dispatchAdmin();
                            const newUserAdmin = await dispatcher.userUpdateAdmin({
                              projectId: this.props.server.getProjectId(),
                              userId: userId!,
                              userUpdateAdmin: { isMod: !user?.isMod },
                            });
                            this.setState({ password: undefined, userAdmin: newUserAdmin });
                          }}
                        />
                      )}
                      label={(
                        <FormHelperText component='span'>
                          {user.isMod ? this.props.t('yes') : this.props.t('no')}
                        </FormHelperText>
                      )}
                    />
                  </Grid>
                </Grid>
                <Grid container alignItems='center' className={this.props.classes.item}>
                  <Grid item xs={12} sm={6}><Typography>{this.props.t('user-id')}</Typography></Grid>
                  <Grid item xs={12} sm={6} className={this.props.classes.itemControls}>
                    <Typography>{userId}</Typography>
                  </Grid>
                </Grid>
              </>
            )}
            {!!isMe && !this.props.suppressSignOut && (
              <Grid container alignItems='center' className={this.props.classes.item}>
                <Grid item xs={12} sm={6}><Typography>
                  {this.props.t('sign-out-of-your-account')}
                  {!!isPushOrAnon && (
                    <Collapse in={!!this.state.signoutWarnNoEmail}>
                      <Alert
                        variant='outlined'
                        severity='warning'
                      >
                        {this.props.t('please-add-an-email-before')}
                      </Alert>
                    </Collapse>
                  )}
                </Typography></Grid>
                <Grid item xs={12} sm={6} className={this.props.classes.itemControls}>
                  <Button
                    disabled={!!isPushOrAnon && !!this.state.signoutWarnNoEmail}
                    onClick={() => {
                      if (isPushOrAnon) {
                        this.setState({ signoutWarnNoEmail: true });
                      } else {
                        this.props.server.dispatch().then(d => d.userLogout({
                          projectId: this.props.server.getProjectId(),
                        }));
                      }
                    }}
                  >{this.props.t('sign-out')}</Button>
                </Grid>
              </Grid>
            )}
            <Grid container alignItems='center' className={this.props.classes.item}>
              <Grid item xs={12} sm={6}><Typography>{this.props.t('delete-account')}</Typography></Grid>
              <Grid item xs={12} sm={6} className={this.props.classes.itemControls}>
                <Button
                  onClick={() => this.setState({ deleteDialogOpen: true })}
                >{this.props.t('delete')}</Button>
                <Dialog
                  open={!!this.state.deleteDialogOpen}
                  onClose={() => this.setState({ deleteDialogOpen: false })}
                >
                  <DialogTitle>Delete account?</DialogTitle>
                  <DialogContent>
                    <DialogContentText>{isMe
                      ? 'By deleting your account, you will be signed out of your account and your account will be permanently deleted including all of your data.'
                      : 'Are you sure you want to permanently delete this user?'}</DialogContentText>
                  </DialogContent>
                  <DialogActions>
                    <Button onClick={() => this.setState({ deleteDialogOpen: false })}>Cancel</Button>
                    <Button style={{ color: this.props.theme.palette.error.main }} onClick={async () => {
                      if (isModOrAdminLoggedIn) {
                        await (await this.props.server.dispatchAdmin()).userDeleteAdmin({
                          projectId: this.props.server.getProjectId(),
                          userId: userId!,
                        });
                      } else {
                        await (await this.props.server.dispatch()).userDelete({
                          projectId: this.props.server.getProjectId(),
                          userId: userId!,
                        });
                      }
                      this.props.onDeleted?.();
                      this.setState({ deleteDialogOpen: false });
                    }}>{this.props.t('delete')}</Button>
                  </DialogActions>
                </Dialog>
              </Grid>
            </Grid>
          </div>
          <div className={this.props.classes.section}>
            <PanelTitle text={this.props.t('notifications')} />
            {browserPushControl && (
              <Grid container alignItems='center' className={this.props.classes.item}>
                <Grid item xs={12} sm={6}><Typography>{this.props.t('browser-desktop-messages')}</Typography></Grid>
                <Grid item xs={12} sm={6} className={this.props.classes.itemControls}>{browserPushControl}</Grid>
              </Grid>
            )}
            {/* {androidPushControl && (
              <Grid container alignItems='center' className={this.props.classes.item}>
                <Grid item xs={12} sm={6}><Typography>Android Push messages</Typography></Grid>
                <Grid item xs={12} sm={6} className={this.props.classes.itemControls}>{androidPushControl}</Grid>
              </Grid>
            )}
            {iosPushControl && (
              <Grid container alignItems='center' className={this.props.classes.item}>
                <Grid item xs={12} sm={6}><Typography>Apple iOS Push messages</Typography></Grid>
                <Grid item xs={12} sm={6} className={this.props.classes.itemControls}>{iosPushControl}</Grid>
              </Grid>
            )} */}
            {emailControl && (
              <Grid container alignItems='center' className={this.props.classes.item}>
                <Grid item xs={12} sm={6}>
                  <Typography>
                    {this.props.t('email')}
                    {user.email !== undefined && (<Typography variant='caption'>&nbsp;({truncateWithElipsis(20, user.email)})</Typography>)}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6} className={this.props.classes.itemControls}>{emailControl}</Grid>
              </Grid>
            )}
            {categoriesWithSubscribe.map(category => !!user && (
              <Grid container alignItems='center' className={this.props.classes.item}>
                <Grid item xs={12} sm={6}>
                  <Typography>{this.props.t('new-category', { category: category.name })}</Typography>
                </Grid>
                <Grid item xs={12} sm={6} className={this.props.classes.itemControls}>
                  {this.renderCategorySubscribeControl(category, isMe, user)}
                </Grid>
              </Grid>
            ))}
          </div>
        </React.Fragment>
      );
    }

    return (
      <div className={classNames(this.props.className, this.props.classes.settings)}>
        {content}
      </div>
    );
  }

  renderCategorySubscribeControl(category: Client.Category, isMe: boolean, user: Client.UserMe | Admin.UserAdmin) {
    if (!category.subscription) return null;

    const isSubscribed = user?.categorySubscriptions?.includes(category.categoryId);

    if (!isMe) {
      return user.browserPush ? this.props.t('subscribed') : this.props.t('not-subscribed');
    }

    return (
      <FormControlLabel
        control={(
          <Switch
            color='default'
            checked={!!isSubscribed}
            onChange={async (e, checked) => {
              const dispatcher = await this.props.server.dispatch();
              await dispatcher.categorySubscribe({
                projectId: this.props.server.getProjectId(),
                categoryId: category.categoryId,
                subscribe: !isSubscribed,
              });
            }}
          />
        )}
        label={(
          <FormHelperText component='span'>
            {isSubscribed ? this.props.t('subscribed') : this.props.t('not-subscribed')}
          </FormHelperText>
        )}
      />
    );
  }

  renderBrowserPushControl(isMe: boolean, user: Client.UserMe | Admin.UserAdmin): React.ReactNode | null {
    if (!this.props.config || !user || (!this.props.config.users.onboarding.notificationMethods.browserPush && !user.browserPush)) {
      return null;
    }

    if (!isMe) {
      return user.browserPush ? this.props.t('receiving') : this.props.t('not-receiving');
    }

    const browserPushStatus = WebNotification.getInstance().getStatus();
    var browserPushEnabled = !!user.browserPush;
    var browserPushControlDisabled;
    var browserPushLabel;
    if (user.browserPush) {
      browserPushControlDisabled = false;
      browserPushLabel = this.props.t('enabled');
    } else {
      switch (browserPushStatus) {
        case WebNotificationStatus.Unsupported:
          browserPushControlDisabled = true;
          browserPushLabel = 'Not supported by your browser';
          break;
        case WebNotificationStatus.Denied:
          browserPushControlDisabled = true;
          browserPushLabel = 'You have declined access to notifications';
          break;
        default:
        case WebNotificationStatus.Available:
        case WebNotificationStatus.Granted:
          browserPushControlDisabled = false;
          browserPushLabel = this.props.t('disabled');
          break;
      }
    }

    return (
      <FormControlLabel
        control={(
          <Switch
            color='default'
            disabled={browserPushControlDisabled}
            checked={browserPushEnabled}
            onChange={(e, checked) => {
              if (checked) {
                WebNotification.getInstance().askPermission()
                  .then(r => {
                    if (r.type === 'success') {
                      this.props.server.dispatch().then(d => d.userUpdate({
                        projectId: this.props.server.getProjectId(),
                        userId: user.userId,
                        userUpdate: { browserPushToken: r.token },
                      }));
                    } else if (r.type === 'error') {
                      if (r.userFacingMsg) {
                        this.props.enqueueSnackbar(r.userFacingMsg || 'Failed to setup browser notifications', { variant: 'error', preventDuplicate: true });
                      }
                      this.forceUpdate();
                    }
                  });
              } else {
                this.props.server.dispatch().then(d => d.userUpdate({
                  projectId: this.props.server.getProjectId(),
                  userId: user.userId,
                  userUpdate: { browserPushToken: '' },
                }));
              }
            }}
          />
        )}
        label={<FormHelperText component='span' error={browserPushControlDisabled}>{browserPushLabel}</FormHelperText>}
      />
    );
  }

  // renderMobilePushControl(device: MobileNotificationDevice) {
  //   if (!this.props.config || !user || (!this.props.config.users.onboarding.notificationMethods.mobilePush && (
  //     (device === MobileNotificationDevice.Android && !user.androidPush)
  //     || (device === MobileNotificationDevice.Ios && !user.iosPush)
  //   ))) {
  //     return;
  //   }


  //   const mobilePushStatus = MobileNotification.getInstance().getStatus();
  //   var mobilePushEnabled = false;
  //   var mobilePushControlDisabled;
  //   var mobilePushLabel;
  //   if ((device === MobileNotificationDevice.Android && user.androidPush)
  //     || (device === MobileNotificationDevice.Ios && user.iosPush)) {
  //     mobilePushEnabled = true;
  //     mobilePushControlDisabled = false;
  //     mobilePushLabel = 'Enabled';
  //   } else if (MobileNotification.getInstance().getDevice() !== device) {
  //     mobilePushControlDisabled = true;
  //     mobilePushLabel = 'Not supported on current device';
  //   } else {
  //     switch (mobilePushStatus) {
  //       case MobileNotificationStatus.Disconnected:
  //         mobilePushControlDisabled = true;
  //         mobilePushLabel = 'Not supported on current device';
  //         break;
  //       case MobileNotificationStatus.Denied:
  //         mobilePushControlDisabled = true;
  //         mobilePushLabel = 'You have declined access to notifications';
  //         break;
  //       default:
  //       case MobileNotificationStatus.Available:
  //       case MobileNotificationStatus.Subscribed:
  //         mobilePushControlDisabled = false;
  //         mobilePushLabel = 'Supported by your browser';
  //         break;
  //     }
  //   }

  //   return (
  //     <FormControlLabel
  //       control={(
  //         <Switch
  //           color='default'
  //           disabled={mobilePushControlDisabled}
  //           checked={mobilePushEnabled}
  //           onChange={(e, checked) => {
  //             if (checked) {
  //               WebNotification.getInstance().askPermission()
  //                 .then(r => {
  //                   if (r.type === 'success') {
  //                     this.props.server.dispatch().userUpdate({
  //                       projectId: this.props.server.getProjectId(),
  //                       userId: userId!,
  //                       userUpdate: device === MobileNotificationDevice.Android
  //                         ? { androidPushToken: r.token }
  //                         : { iosPushToken: r.token },
  //                     });
  //                   } else if (r.type === 'error') {
  //                     if (r.userFacingMsg) {
  //                       this.props.enqueueSnackbar(r.userFacingMsg || 'Failed to setup mobile notifications', { variant: 'error', preventDuplicate: true });
  //                     }
  //                     this.forceUpdate();
  //                   }
  //                 });
  //             } else {
  //               this.props.server.dispatch().userUpdate({
  //                 projectId: this.props.server.getProjectId(),
  //                 userId: userId!,
  //                 userUpdate: device === MobileNotificationDevice.Android
  //                   ? { androidPushToken: '' }
  //                   : { iosPushToken: '' },
  //               });
  //             }
  //           }}
  //         />
  //       )}
  //       label={<FormHelperText component='span' error={mobilePushControlDisabled}>{mobilePushLabel}</FormHelperText>}
  //     />
  //   );
  // }

  renderEmailControl(isMe: boolean, user: Client.UserMe | Admin.UserAdmin) {
    if (!this.props.config || !user || (!this.props.config.users.onboarding.notificationMethods.email && !user.email)) {
      return;
    }

    if (!isMe) {
      return user.browserPush ? this.props.t('receiving') : this.props.t('not-receiving');
    }

    var enabled;
    var controlDisabled;
    var label;
    if (user.email) {
      controlDisabled = false;
      enabled = user.emailNotify;
      if (user.emailNotify) {
        label = this.props.t('enabled');
      } else {
        label = this.props.t('disabled');
      }
    } else {
      controlDisabled = true;
      enabled = false;
      label = 'No email on account';
    }

    return (
      <FormControlLabel
        control={(
          <Switch
            color='default'
            disabled={controlDisabled}
            checked={enabled}
            onChange={async (e, checked) => {
              this.props.server.dispatch().then(d => d.userUpdate({
                projectId: this.props.server.getProjectId(),
                userId: user.userId,
                userUpdate: { emailNotify: checked },
              }));
            }}
          />
        )}
        label={<FormHelperText component='span' error={controlDisabled}>{label}</FormHelperText>}
      />
    );
  }

  renderProfilePicActions(user: Client.UserMe | Admin.UserAdmin, userId: string, isModOrAdminLoggedIn: boolean) {
    const fileInputRef = React.createRef<HTMLInputElement>();

    const handleFileSelect = async (file: File | undefined) => {
      if (!file) return;

      // Validate file type
      if (!file.type.startsWith('image/')) {
        this.props.enqueueSnackbar('Please select an image file', { variant: 'error' });
        return;
      }

      // Validate file size (max 20MB)
      if (file.size > 20 * 1024 * 1024) {
        this.props.enqueueSnackbar('Image size must be less than 20MB', { variant: 'error' });
        return;
      }

      // Upload immediately
      this.setState({ profilePicUploading: true });
      try {
        // Use admin endpoint if admin is uploading for another user
        if (isModOrAdminLoggedIn && this.props.loggedInUser?.userId !== userId) {
          const dispatcher = await this.props.server.dispatchAdmin();
          await dispatcher.profilepicUploadAsAdmin({
            projectId: this.props.server.getProjectId(),
            userId,
            body: file,
          });
        } else {
          const dispatcher = await this.props.server.dispatch();
          await dispatcher.profilepicUpload({
            projectId: this.props.server.getProjectId(),
            body: file,
          });
        }

        this.props.enqueueSnackbar('Profile picture updated successfully', { variant: 'success' });

        // Refresh user data in Redux
        if (isModOrAdminLoggedIn && this.props.loggedInUser?.userId !== userId) {
          const newUserAdmin = await (await this.props.server.dispatchAdmin()).userGetAdmin({
            projectId: this.props.server.getProjectId(),
            userId,
          });
          this.setState({ userAdmin: newUserAdmin });
        } else {
          // Re-bind to refresh the logged-in user in Redux
          await dispatcher.userBind({
            projectId: this.props.server.getProjectId(),
            userBind: {},
          });
        }
      } catch (error) {
        this.props.enqueueSnackbar('Failed to upload profile picture', { variant: 'error' });
      } finally {
        this.setState({ profilePicUploading: false });
      }
    };

    const handleDelete = async () => {
      this.setState({ profilePicUploading: true });
      try {
        if (isModOrAdminLoggedIn && this.props.loggedInUser?.userId !== userId) {
          const newUserAdmin = await (await this.props.server.dispatchAdmin()).userUpdateAdmin({
            projectId: this.props.server.getProjectId(),
            userId,
            userUpdateAdmin: { pic: '', picUrl: '' },
          });
          this.setState({ userAdmin: newUserAdmin });
        } else {
          const dispatcher = await this.props.server.dispatch();
          await dispatcher.userUpdate({
            projectId: this.props.server.getProjectId(),
            userId,
            userUpdate: { pic: '', picUrl: '' },
          });
        }

        this.props.enqueueSnackbar('Profile picture removed', { variant: 'success' });
      } catch (error) {
        this.props.enqueueSnackbar('Failed to remove profile picture', { variant: 'error' });
      } finally {
        this.setState({ profilePicUploading: false });
      }
    };

    return (
      <>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className={this.props.classes.hiddenInput}
          onChange={(e) => handleFileSelect(e.target.files?.[0])}
        />
        <IconButton
          className={this.props.classes.uploadIconButton}
          size="small"
          onClick={() => fileInputRef.current?.click()}
          disabled={this.state.profilePicUploading}
        >
          {this.state.profilePicUploading ? (
            <CircularProgress size={24} />
          ) : (
            <CloudUploadIcon className={this.props.classes.uploadIcon} />
          )}
        </IconButton>
        {user.pic === 'uploaded' && (
          <IconButton
            className={this.props.classes.deleteIconButton}
            size="small"
            onClick={handleDelete}
            disabled={this.state.profilePicUploading}
          >
            <DeleteIcon className={this.props.classes.deleteIcon} />
          </IconButton>
        )}
      </>
    );
  }

  renderProfilePicDialog(user: Client.UserMe | Admin.UserAdmin, userId: string, isModOrAdminLoggedIn: boolean) {
    const fileInputRef = React.createRef<HTMLInputElement>();

    const handleFileSelect = (file: File | undefined) => {
      if (!file) return;

      // Validate file type
      if (!file.type.startsWith('image/')) {
        this.props.enqueueSnackbar('Please select an image file', { variant: 'error' });
        return;
      }

      // Validate file size (max 20MB)
      if (file.size > 20 * 1024 * 1024) {
        this.props.enqueueSnackbar('Image size must be less than 20MB', { variant: 'error' });
        return;
      }

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        this.setState({
          profilePicFile: file,
          profilePicPreview: e.target?.result as string,
        });
      };
      reader.readAsDataURL(file);
    };

    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      this.setState({ profilePicDragActive: false });

      const file = e.dataTransfer.files[0];
      handleFileSelect(file);
    };

    const handleUpload = async () => {
      if (!this.state.profilePicFile) return;

      this.setState({ profilePicUploading: true });
      try {
        // Use admin endpoint if admin is uploading for another user
        if (isModOrAdminLoggedIn && this.props.loggedInUser?.userId !== userId) {
          const dispatcher = await this.props.server.dispatchAdmin();
          await dispatcher.profilepicUploadAsAdmin({
            projectId: this.props.server.getProjectId(),
            userId,
            body: this.state.profilePicFile,
          });
        } else {
          const dispatcher = await this.props.server.dispatch();
          await dispatcher.profilepicUpload({
            projectId: this.props.server.getProjectId(),
            body: this.state.profilePicFile,
          });
        }

        this.props.enqueueSnackbar('Profile picture updated successfully', { variant: 'success' });
        this.setState({
          profilePicDialogOpen: false,
          profilePicFile: undefined,
          profilePicPreview: undefined,
        });

        // Refresh user data in Redux
        if (isModOrAdminLoggedIn && this.props.loggedInUser?.userId !== userId) {
          const newUserAdmin = await (await this.props.server.dispatchAdmin()).userGetAdmin({
            projectId: this.props.server.getProjectId(),
            userId,
          });
          this.setState({ userAdmin: newUserAdmin });
        } else {
          // Re-bind to refresh the logged-in user in Redux
          await dispatcher.userBind({
            projectId: this.props.server.getProjectId(),
            userBind: {},
          });
        }
      } catch (error) {
        this.props.enqueueSnackbar('Failed to upload profile picture', { variant: 'error' });
      } finally {
        this.setState({ profilePicUploading: false });
      }
    };

    const handleDelete = async () => {
      this.setState({ profilePicUploading: true });
      try {
        if (isModOrAdminLoggedIn && this.props.loggedInUser?.userId !== userId) {
          const newUserAdmin = await (await this.props.server.dispatchAdmin()).userUpdateAdmin({
            projectId: this.props.server.getProjectId(),
            userId,
            userUpdateAdmin: { pic: '', picUrl: '' },
          });
          this.setState({
            userAdmin: newUserAdmin,
            profilePicDialogOpen: false,
          });
        } else {
          const dispatcher = await this.props.server.dispatch();
          await dispatcher.userUpdate({
            projectId: this.props.server.getProjectId(),
            userId,
            userUpdate: { pic: '', picUrl: '' },
          });
          this.setState({ profilePicDialogOpen: false });
        }

        this.props.enqueueSnackbar('Profile picture removed', { variant: 'success' });
      } catch (error) {
        this.props.enqueueSnackbar('Failed to remove profile picture', { variant: 'error' });
      } finally {
        this.setState({ profilePicUploading: false });
      }
    };

    const currentPicUrl = this.state.profilePicPreview || (user.pic === 'uploaded' ? user.picUrl : undefined);

    return (
      <Dialog
        open={!!this.state.profilePicDialogOpen}
        onClose={() => this.setState({
          profilePicDialogOpen: false,
          profilePicFile: undefined,
          profilePicPreview: undefined,
        })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Profile Picture</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" alignItems="center">
            {currentPicUrl ? (
              <img
                src={currentPicUrl}
                alt="Profile preview"
                className={this.props.classes.profilePicPreview}
              />
            ) : (
              <div className={this.props.classes.avatarPreviewContainer}>
                <AvatarDisplay user={user} size={150} />
              </div>
            )}

            {!this.state.profilePicFile && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className={this.props.classes.hiddenInput}
                  onChange={(e) => handleFileSelect(e.target.files?.[0])}
                />
                <div
                  className={classNames(
                    this.props.classes.uploadArea,
                    this.state.profilePicDragActive && this.props.classes.uploadAreaDragActive
                  )}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    this.setState({ profilePicDragActive: true });
                  }}
                  onDragLeave={() => this.setState({ profilePicDragActive: false })}
                  onDrop={handleDrop}
                >
                  <CloudUploadIcon style={{ fontSize: 48, marginBottom: 8 }} color="action" />
                  <Typography variant="body1">
                    Drag & drop an image here, or click to select
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    Max size: 20MB
                  </Typography>
                </div>
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <div style={{ flex: 1 }} />
          {user.pic === 'uploaded' && !this.state.profilePicFile && (
            <Button
              onClick={handleDelete}
              disabled={this.state.profilePicUploading}
              startIcon={<DeleteIcon />}
              style={{ color: this.props.theme.palette.error.main }}
            >
              Remove Picture
            </Button>
          )}
          <Button
            onClick={() => this.setState({
              profilePicDialogOpen: false,
              profilePicFile: undefined,
              profilePicPreview: undefined,
            })}
            disabled={this.state.profilePicUploading}
          >
            Cancel
          </Button>
          {this.state.profilePicFile && (
            <Button
              onClick={handleUpload}
              disabled={this.state.profilePicUploading}
              color="primary"
              variant="contained"
              startIcon={this.state.profilePicUploading ? <CircularProgress size={20} /> : <CloudUploadIcon />}
            >
              {this.state.profilePicUploading ? 'Uploading...' : 'Upload'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    );
  }
}

export default connect<ConnectProps, {}, Props, ReduxState>((state, ownProps) => {
  const connectProps: ConnectProps = {
    configver: state.conf.ver, // force rerender on config change
    config: state.conf.conf,
    loggedInUser: state.users.loggedIn.user,
    loggedInUserBalance: state.credits.myBalance.balance,
    user: ownProps.userId ? state.users.byId[ownProps.userId]?.user : undefined,
    categories: state.conf.conf?.content.categories,
    credits: state.conf.conf ? state.conf.conf.users.credits : undefined,
  };
  return connectProps;
}, null, null, { forwardRef: true })(withStyles(styles, { withTheme: true })(
  withMediaQuery(theme => theme.breakpoints.down('xs'))(withSnackbar(withTranslation('app', { withRef: true })(UserEdit)))));
