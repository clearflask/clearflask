import { Button, Collapse, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControlLabel, FormHelperText, Grid, IconButton, InputAdornment, Switch, TextField, Tooltip, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import VisibilityIcon from '@material-ui/icons/Visibility';
import VisibilityOffIcon from '@material-ui/icons/VisibilityOff';
import { Alert } from '@material-ui/lab';
import { withSnackbar, WithSnackbarProps } from 'notistack';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import * as Client from '../api/client';
import { ReduxState, Server } from '../api/server';
import WebNotification, { Status as WebNotificationStatus } from '../common/notification/webNotification';
import UserContributions from '../common/UserContributions';
import ErrorPage from './ErrorPage';
import DividerCorner from './utils/DividerCorner';

const styles = (theme: Theme) => createStyles({
  page: {
    margin: theme.spacing(1),
    display: 'flex',
    flexWrap: 'wrap',
  },
  item: {
    marginTop: theme.spacing(2),
  },
  itemControls: {
    display: 'flex',
    alignItems: 'center',
  },
  section: {
    marginTop: theme.spacing(3),
  },
  sectionInner: {
    padding: theme.spacing(2),
  },
  title: {
    minWidth: '100%',
    margin: theme.spacing(0, 5),
  },
  settings: {
    minWidth: 400,
    maxWidth: '100%',
    flex: '1 1 0px',
  },
  userContributions: {
    minWidth: 300,
    maxWidth: '100%',
    flex: '1 1 0px',
  },
});
interface Props {
  server: Server;
}
interface ConnectProps {
  configver?: string;
  config?: Client.Config;
  userMe?: Client.UserMe;
  categories?: Client.Category[];
}
interface State {
  deleteDialogOpen?: boolean;
  displayName?: string;
  email?: string;
  password?: string;
  revealPassword?: boolean;
  signoutWarnNoEmail?: boolean;
}
class AccountPage extends Component<Props & ConnectProps & WithStyles<typeof styles, true> & WithSnackbarProps, State> {
  state: State = {};

  render() {
    if (!this.props.userMe) {
      return (<ErrorPage msg='You need to log in to see your account details' variant='info' />);
    }

    const browserPushControl = this.renderBrowserPushControl();
    // const androidPushControl = this.renderMobilePushControl(MobileNotificationDevice.Android);
    // const iosPushControl = this.renderMobilePushControl(MobileNotificationDevice.Ios);
    const emailControl = this.renderEmailControl();

    const isPushOrAnon = !this.props.userMe.email && !this.props.userMe.isExternal;

    const categoriesWithSubscribe = (this.props.categories || []).filter(c => !!c.subscription);

    return (
      <div className={this.props.classes.page}>
        <Typography component="h1" variant="h5" color="textPrimary" className={this.props.classes.title}>Your profile</Typography>
        <div className={this.props.classes.settings}>
          <DividerCorner
            title='Account'
            className={this.props.classes.section}
            innerClassName={this.props.classes.sectionInner}
          >
            <Grid container alignItems='center' className={this.props.classes.item}>
              <Grid item xs={12} sm={6}><Typography>Display name</Typography></Grid>
              <Grid item xs={12} sm={6} className={this.props.classes.itemControls}>
                {!!this.props.userMe.isExternal ? (
                  <Tooltip title="Cannot be changed" placement='top-start'>
                    <Typography>{this.props.userMe.name || 'None'}</Typography>
                  </Tooltip>
                ) : (
                  <React.Fragment>
                    <TextField
                      id='displayName'
                      error={!this.props.userMe.name}
                      value={(this.state.displayName === undefined ? this.props.userMe.name : this.state.displayName) || ''}
                      onChange={e => this.setState({ displayName: e.target.value })}
                    />
                    <Button aria-label="Save" color='primary' style={{
                      visibility:
                        !this.state.displayName
                          || this.state.displayName === this.props.userMe.name
                          ? 'hidden' : undefined
                    }} onClick={() => {
                      if (!this.state.displayName
                        || !this.props.userMe
                        || this.state.displayName === this.props.userMe.name) {
                        return;
                      }
                      this.props.server.dispatch().then(d => d.userUpdate({
                        projectId: this.props.server.getProjectId(),
                        userId: this.props.userMe!.userId,
                        userUpdate: { name: this.state.displayName },
                      }));
                    }}>Save</Button>
                  </React.Fragment>
                )}
              </Grid>
            </Grid>
            <Grid container alignItems='center' className={this.props.classes.item}>
              <Grid item xs={12} sm={6}><Typography>Email</Typography></Grid>
              <Grid item xs={12} sm={6} className={this.props.classes.itemControls}>
                {!!this.props.userMe.isExternal ? (
                  <Tooltip title="Cannot be changed" placement='top-start'>
                    <Typography>{this.props.userMe.email || 'None'}</Typography>
                  </Tooltip>
                ) : (
                  <React.Fragment>
                    <TextField
                      id='email'
                      value={(this.state.email === undefined ? this.props.userMe.email : this.state.email) || ''}
                      onChange={e => this.setState({ email: e.target.value })}
                    />
                    <Button aria-label="Save" color='primary' style={{
                      visibility:
                        !this.state.email
                          || this.state.email === this.props.userMe.email
                          ? 'hidden' : undefined
                    }} onClick={() => {
                      if (!this.state.email
                        || !this.props.userMe
                        || this.state.email === this.props.userMe.email) {
                        return;
                      }
                      this.props.server.dispatch().then(d => d.userUpdate({
                        projectId: this.props.server.getProjectId(),
                        userId: this.props.userMe!.userId,
                        userUpdate: { email: this.state.email },
                      }));
                    }}>Save</Button>
                  </React.Fragment>
                )}
              </Grid>
            </Grid>
            {!this.props.userMe.isExternal && (
              <Grid container alignItems='center' className={this.props.classes.item}>
                <Grid item xs={12} sm={6}><Typography>Password</Typography></Grid>
                <Grid item xs={12} sm={6} className={this.props.classes.itemControls}>
                  <TextField
                    id='password'
                    value={this.state.password || ''}
                    onChange={e => this.setState({ password: e.target.value })}
                    type={this.state.revealPassword ? 'text' : 'password'}
                    disabled={!this.state.email && !this.props.userMe.email}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position='end'>
                          <IconButton
                            aria-label='Toggle password visibility'
                            onClick={() => this.setState({ revealPassword: !this.state.revealPassword })}
                            disabled={!this.state.email && !this.props.userMe.email}
                          >
                            {this.state.revealPassword ? <VisibilityIcon fontSize='small' /> : <VisibilityOffIcon fontSize='small' />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                  <Button aria-label="Save" color='primary' style={{
                    visibility:
                      !this.state.password
                        || this.state.password === this.props.userMe.name
                        ? 'hidden' : undefined
                  }} onClick={() => {
                    if (!this.state.password
                      || !this.props.userMe) {
                      return;
                    }
                    this.props.server.dispatch().then(d => d.userUpdate({
                      projectId: this.props.server.getProjectId(),
                      userId: this.props.userMe!.userId,
                      userUpdate: { password: this.state.password },
                    })).then(() => this.setState({ password: undefined }));
                  }}>Save</Button>
                </Grid>
              </Grid>
            )}
            <Grid container alignItems='center' className={this.props.classes.item}>
              <Grid item xs={12} sm={6}><Typography>
                Sign out of your account
              {!!isPushOrAnon && (
                  <Collapse in={!!this.state.signoutWarnNoEmail}>
                    <Alert
                      variant='outlined'
                      severity='warning'
                    >
                      Please add an email before signing out or delete your account instead.
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
                >Sign out</Button>
              </Grid>
            </Grid>
            <Grid container alignItems='center' className={this.props.classes.item}>
              <Grid item xs={12} sm={6}><Typography>Delete your account</Typography></Grid>
              <Grid item xs={12} sm={6} className={this.props.classes.itemControls}>
                <Button
                  onClick={() => this.setState({ deleteDialogOpen: true })}
                >Delete</Button>
                <Dialog
                  open={!!this.state.deleteDialogOpen}
                  onClose={() => this.setState({ deleteDialogOpen: false })}
                >
                  <DialogTitle>Delete account?</DialogTitle>
                  <DialogContent>
                    <DialogContentText>By deleting your account, you will be signed out of your account and your account will be permanently deleted including all of your data.</DialogContentText>
                  </DialogContent>
                  <DialogActions>
                    <Button onClick={() => this.setState({ deleteDialogOpen: false })}>Cancel</Button>
                    <Button style={{ color: this.props.theme.palette.error.main }} onClick={() => this.props.server.dispatch().then(d => d.userDelete({
                      projectId: this.props.server.getProjectId(),
                      userId: this.props.userMe!.userId,
                    }))}>Delete</Button>
                  </DialogActions>
                </Dialog>
              </Grid>
            </Grid>
          </DividerCorner>
          <DividerCorner
            title='Notifications'
            className={this.props.classes.section}
            innerClassName={this.props.classes.sectionInner}
          >
            {browserPushControl && (
              <Grid container alignItems='center' className={this.props.classes.item}>
                <Grid item xs={12} sm={6}><Typography>Browser desktop messages</Typography></Grid>
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
                    Email
                  {this.props.userMe.email !== undefined && (<Typography variant='caption'>&nbsp;({this.props.userMe.email})</Typography>)}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6} className={this.props.classes.itemControls}>{emailControl}</Grid>
              </Grid>
            )}
            {categoriesWithSubscribe.length > 0 && (
              <div className={this.props.classes.section}>
                {categoriesWithSubscribe.map(category => (
                  <Grid container alignItems='center' className={this.props.classes.item}>
                    <Grid item xs={12} sm={6}>
                      <Typography>New {category.name}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={6} className={this.props.classes.itemControls}>
                      {this.renderCategorySubscribeControl(category)}
                    </Grid>
                  </Grid>
                ))}
              </div>
            )}
          </DividerCorner>
        </div>
        <div className={this.props.classes.userContributions}>
          <UserContributions server={this.props.server} userId={this.props.userMe.userId} />
        </div>
      </div>
    );
  }

  renderCategorySubscribeControl(category: Client.Category) {
    if (!category.subscription) return null;

    const isSubscribed = this.props.userMe?.categorySubscriptions?.includes(category.categoryId);

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
            {isSubscribed ? 'Subscribed' : 'Unsubscribed'}
          </FormHelperText>
        )}
      />
    );
  }

  renderBrowserPushControl() {
    if (!this.props.config || !this.props.userMe || (!this.props.config.users.onboarding.notificationMethods.browserPush && !this.props.userMe.browserPush)) {
      return;
    }

    const browserPushStatus = WebNotification.getInstance().getStatus();
    var browserPushEnabled = !!this.props.userMe.browserPush;
    var browserPushControlDisabled;
    var browserPushLabel;
    if (this.props.userMe.browserPush) {
      browserPushControlDisabled = false;
      browserPushLabel = 'Enabled';
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
          browserPushLabel = 'Disabled';
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
                        userId: this.props.userMe!.userId,
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
                  userId: this.props.userMe!.userId,
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
  //   if (!this.props.config || !this.props.userMe || (!this.props.config.users.onboarding.notificationMethods.mobilePush && (
  //     (device === MobileNotificationDevice.Android && !this.props.userMe.androidPush)
  //     || (device === MobileNotificationDevice.Ios && !this.props.userMe.iosPush)
  //   ))) {
  //     return;
  //   }


  //   const mobilePushStatus = MobileNotification.getInstance().getStatus();
  //   var mobilePushEnabled = false;
  //   var mobilePushControlDisabled;
  //   var mobilePushLabel;
  //   if ((device === MobileNotificationDevice.Android && this.props.userMe.androidPush)
  //     || (device === MobileNotificationDevice.Ios && this.props.userMe.iosPush)) {
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
  //                       userId: this.props.userMe!.userId,
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
  //                 userId: this.props.userMe!.userId,
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

  renderEmailControl() {
    if (!this.props.config || !this.props.userMe || (!this.props.config.users.onboarding.notificationMethods.email && !this.props.userMe.email)) {
      return;
    }

    var enabled;
    var controlDisabled;
    var label;
    if (this.props.userMe.email) {
      controlDisabled = false;
      enabled = this.props.userMe.emailNotify;
      if (this.props.userMe.emailNotify) {
        label = 'Enabled';
      } else {
        label = 'Disabled';
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
            onChange={(e, checked) => {
              this.props.server.dispatch().then(d => d.userUpdate({
                projectId: this.props.server.getProjectId(),
                userId: this.props.userMe!.userId,
                userUpdate: { emailNotify: checked },
              }));
            }}
          />
        )}
        label={<FormHelperText component='span' error={controlDisabled}>{label}</FormHelperText>}
      />
    );
  }
}

export default connect<ConnectProps, {}, Props, ReduxState>((state, ownProps) => {
  const connectProps: ConnectProps = {
    configver: state.conf.ver, // force rerender on config change
    config: state.conf.conf,
    userMe: state.users.loggedIn.user,
    categories: state.conf.conf?.content.categories,
  };
  return connectProps;
}, null, null, { forwardRef: true })(withStyles(styles, { withTheme: true })(withSnackbar(AccountPage)));
