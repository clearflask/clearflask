import { Button, Collapse, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton, InputAdornment, List, ListItem, ListItemIcon, ListItemText, ListSubheader, TextField } from '@material-ui/core';
import { DialogProps } from '@material-ui/core/Dialog';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import withMobileDialog, { InjectedProps } from '@material-ui/core/withMobileDialog';
import { WithWidth } from '@material-ui/core/withWidth';
import DisabledIcon from '@material-ui/icons/Block';
import EmailIcon from '@material-ui/icons/Email';
/** Alternatives: NotificationsActive, Web */
import WebPushIcon from '@material-ui/icons/NotificationsActive';
/** Alternatives: AccountCircle, Fingerprint, HowToReg, Person, PersonAdd, OpenInNew */
import SsoIcon from '@material-ui/icons/OpenInNew';
/** Alternatives: PhonelinkRing, Vibration */
import MobilePushIcon from '@material-ui/icons/PhonelinkRing';
import VisibilityIcon from '@material-ui/icons/Visibility';
import VisibilityOffIcon from '@material-ui/icons/VisibilityOff';
import SilentIcon from '@material-ui/icons/Web';
import { withSnackbar, WithSnackbarProps } from 'notistack';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import * as Client from '../../api/client';
import { ReduxState, Server, Status } from '../../api/server';
import AcceptTerms from '../../common/AcceptTerms';
import Hr from '../../common/Hr';
import MobileNotification, { Device } from '../../common/notification/mobileNotification';
import WebNotification from '../../common/notification/webNotification';
import { saltHashPassword } from '../../common/util/auth';
import { BIND_SUCCESS_LOCALSTORAGE_EVENT_KEY } from '../App';
import SubmitButton from '../../common/SubmitButton';
type WithMobileDialogProps = InjectedProps & Partial<WithWidth>;

enum NotificationType {
  Email = 'email',
  Browser = 'browser',
  Ios = 'ios',
  Android = 'android',
  Silent = 'silent',
  SSO = 'sso',
}

const styles = (theme: Theme) => createStyles({
  content: {
    display: 'flex',
  },
  notificationList: {
    padding: '0px',
  },
  accountFieldsContainer: {
    display: 'flex',
    transition: theme.transitions.create(['max-width', 'max-height']),
    width: 'min-content',
    overflow: 'hidden',
  },
  loginFieldsContainer: {
    width: 'min-content',
    overflow: 'hidden',
  },
  noWrap: {
    whiteSpace: 'nowrap',
  },
  allowButton: {
    margin: 'auto',
    display: 'block',
  },
  bold: {
    fontWeight: 'bold',
  },
});

export interface Props {
  server: Server;
  open?: boolean;
  onClose: () => void;
  onLoggedInAndClose: () => void;
  actionTitle?: string;
  overrideWebNotification?: WebNotification;
  overrideMobileNotification?: MobileNotification;
  DialogProps?: Partial<DialogProps>;
  forgotEmailDialogProps?: Partial<DialogProps>;
}

interface ConnectProps {
  configver?: string;
  config?: Client.Config;
  loggedInUser?: Client.UserMe;
}

interface State {
  open?: boolean;
  notificationType?: NotificationType
  notificationDataAndroid?: string
  notificationDataIos?: string
  notificationDataBrowser?: string
  displayName?: string;
  email?: string;
  pass?: string;
  revealPassword?: boolean;
  isLogin?: boolean;
  awaitExternalBind?: 'recovery' | 'sso';
  isSubmitting?: boolean;
}

class LogIn extends Component<Props & ConnectProps & WithStyles<typeof styles, true> & WithSnackbarProps & WithMobileDialogProps, State> {
  state: State = {};
  storageListener?: any;

  componentWillUnmount() {
    this.storageListener && window.removeEventListener('storage', this.storageListener);
  }

  render() {
    if (!this.props.open) return null;

    const notifOpts: Set<NotificationType> = new Set();
    if (this.props.config) {
      // if (this.props.config.users.onboarding.notificationMethods.mobilePush === true
      //   && (this.props.overrideMobileNotification || MobileNotification.getInstance()).canAskPermission()) {
      //   switch ((this.props.overrideMobileNotification || MobileNotification.getInstance()).getDevice()) {
      //     case Device.Android:
      //       notifOpts.add(NotificationType.Android);
      //       break;
      //     case Device.Ios:
      //       notifOpts.add(NotificationType.Ios);
      //       break;
      //   }
      // }
      if (this.props.config.users.onboarding.notificationMethods.browserPush === true
        && (this.props.overrideWebNotification || WebNotification.getInstance()).canAskPermission()) {
        notifOpts.add(NotificationType.Browser);
      }
      if (this.props.config.users.onboarding.notificationMethods.anonymous
        && (this.props.config.users.onboarding.notificationMethods.anonymous.onlyShowIfPushNotAvailable !== true
          || (!notifOpts.has(NotificationType.Android) && !notifOpts.has(NotificationType.Ios) && !notifOpts.has(NotificationType.Browser)))) {
        notifOpts.add(NotificationType.Silent)
      }
      if (this.props.config.users.onboarding.notificationMethods.email) {
        notifOpts.add(NotificationType.Email);
      }
      if (this.props.config.users.onboarding.notificationMethods.sso) {
        notifOpts.add(NotificationType.SSO);
      }
    }

    var dialogContent;
    if (!!this.props.loggedInUser) {
      dialogContent = (
        <React.Fragment>
          <DialogContent>
            <DialogContentText>You are logged in as <span className={this.props.classes.bold}>{this.props.loggedInUser.name || this.props.loggedInUser.email || 'Anonymous'}</span></DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={this.props.onClose.bind(this)}>Cancel</Button>
            <Button color='primary' onClick={this.props.onLoggedInAndClose.bind(this)}>Continue</Button>
          </DialogActions>
        </React.Fragment>
      );
    } else {
      const signupAllowed = notifOpts.size > 0;
      const loginAllowed = !!this.props.config && !!this.props.config.users.onboarding.notificationMethods.email;
      const isLogin = (signupAllowed && loginAllowed) ? this.state.isLogin : loginAllowed;
      const onlySingleOption = notifOpts.size === 1;
      const singleColumnLayout = this.props.fullScreen || onlySingleOption;

      const selectedNotificationType = !isLogin && (this.state.notificationType && notifOpts.has(this.state.notificationType))
        ? this.state.notificationType
        : (onlySingleOption ? notifOpts.values().next().value : undefined);

      const showEmailInput = selectedNotificationType === NotificationType.Email;
      const showDisplayNameInput = this.props.config && signupAllowed && this.props.config.users.onboarding.accountFields.displayName !== Client.AccountFieldsDisplayNameEnum.None;
      const isDisplayNameRequired = this.props.config && this.props.config.users.onboarding.accountFields.displayName === Client.AccountFieldsDisplayNameEnum.Required;
      const showAccountFields = !isLogin && (showEmailInput || showDisplayNameInput);
      const showPasswordInput = this.props.config && this.props.config.users.onboarding.notificationMethods.email && this.props.config.users.onboarding.notificationMethods.email.password !== Client.EmailSignupPasswordEnum.None;
      const isPasswordRequired = this.props.config && this.props.config.users.onboarding.notificationMethods.email && this.props.config.users.onboarding.notificationMethods.email.password === Client.EmailSignupPasswordEnum.Required;
      const isSignupSubmittable = selectedNotificationType
        && (selectedNotificationType !== NotificationType.SSO)
        && (selectedNotificationType !== NotificationType.Android || this.state.notificationDataAndroid)
        && (selectedNotificationType !== NotificationType.Ios || this.state.notificationDataIos)
        && (selectedNotificationType !== NotificationType.Browser || this.state.notificationDataBrowser)
        && (!isDisplayNameRequired || this.state.displayName)
        && (selectedNotificationType !== NotificationType.Email || this.state.email)
        && (!isPasswordRequired || this.state.pass);
      const isLoginSubmittable = !!this.state.email;
      const isSubmittable = isLogin ? isLoginSubmittable : isSignupSubmittable;

      const onlySingleOptionRequiresAllow = onlySingleOption &&
        ((selectedNotificationType === NotificationType.Android && !this.state.notificationDataAndroid)
          || (selectedNotificationType === NotificationType.Ios && !this.state.notificationDataIos)
          || (selectedNotificationType === NotificationType.Browser && !this.state.notificationDataBrowser));

      dialogContent = (
        <React.Fragment>
          <DialogContent>
            <Collapse in={!isLogin}>
              <div
                className={this.props.classes.content}
                style={singleColumnLayout ? { flexDirection: 'column' } : undefined}
              >
                <List component="nav" className={this.props.classes.notificationList}>
                  <ListSubheader className={this.props.classes.noWrap} component="div">{this.props.actionTitle || 'Create account'}</ListSubheader>
                  <Collapse in={notifOpts.has(NotificationType.SSO)}>
                    <ListItem
                      button={!onlySingleOption as any}
                      selected={!onlySingleOption && selectedNotificationType === NotificationType.SSO}
                      onClick={!onlySingleOption ? this.onClickSsoNotif.bind(this) : e => this.setState({ notificationType: NotificationType.SSO })}
                      disabled={this.state.isSubmitting}
                    >
                      <ListItemIcon><SsoIcon /></ListItemIcon>
                      <ListItemText primary={this.props.config?.users.onboarding.notificationMethods.sso?.buttonTitle
                        || this.props.config?.name
                        || 'External'} />
                    </ListItem>
                    <Collapse in={onlySingleOptionRequiresAllow}>
                      <Button className={this.props.classes.allowButton} onClick={this.onClickSsoNotif.bind(this)}>Open</Button>
                    </Collapse>
                  </Collapse>
                  <Collapse in={notifOpts.has(NotificationType.Android) || notifOpts.has(NotificationType.Ios)}>
                    <ListItem
                      // https://github.com/mui-org/material-ui/pull/15049
                      button={!onlySingleOption as any}
                      selected={!onlySingleOption && (selectedNotificationType === NotificationType.Android || selectedNotificationType === NotificationType.Ios)}
                      onClick={!onlySingleOption ? this.onClickMobileNotif.bind(this) : undefined}
                      disabled={onlySingleOptionRequiresAllow || this.state.isSubmitting}
                    >
                      <ListItemIcon><MobilePushIcon /></ListItemIcon>
                      <ListItemText primary='Mobile Push' className={this.props.classes.noWrap} />
                    </ListItem>
                    <Collapse in={onlySingleOptionRequiresAllow}>
                      <Button className={this.props.classes.allowButton} onClick={this.onClickMobileNotif.bind(this)}>Allow</Button>
                    </Collapse>
                  </Collapse>
                  <Collapse in={notifOpts.has(NotificationType.Browser)}>
                    <ListItem
                      button={!onlySingleOption as any}
                      selected={!onlySingleOption && selectedNotificationType === NotificationType.Browser}
                      onClick={!onlySingleOption ? this.onClickWebNotif.bind(this) : undefined}
                      disabled={onlySingleOptionRequiresAllow || this.state.isSubmitting}
                    >
                      <ListItemIcon><WebPushIcon /></ListItemIcon>
                      <ListItemText primary='Browser Push' className={this.props.classes.noWrap} />
                    </ListItem>
                    <Collapse in={onlySingleOptionRequiresAllow}>
                      <Button className={this.props.classes.allowButton} onClick={this.onClickWebNotif.bind(this)}>Allow</Button>
                    </Collapse>
                  </Collapse>
                  <Collapse in={notifOpts.has(NotificationType.Email)}>
                    <ListItem
                      button={!onlySingleOption as any}
                      selected={!onlySingleOption && selectedNotificationType === NotificationType.Email}
                      onClick={!onlySingleOption ? e => this.setState({ notificationType: NotificationType.Email }) : undefined}
                      disabled={this.state.isSubmitting}
                    >
                      <ListItemIcon><EmailIcon /></ListItemIcon>
                      <ListItemText primary='Email' className={this.props.classes.noWrap} />
                    </ListItem>
                  </Collapse>
                  <Collapse in={notifOpts.has(NotificationType.Silent)}>
                    <ListItem
                      button={!onlySingleOption as any}
                      selected={!onlySingleOption && selectedNotificationType === NotificationType.Silent}
                      onClick={!onlySingleOption ? e => this.setState({ notificationType: NotificationType.Silent }) : undefined}
                      disabled={this.state.isSubmitting}
                    >
                      <ListItemIcon><SilentIcon /></ListItemIcon>
                      <ListItemText primary={onlySingleOption ? 'In-App' : 'In-App Only'} />
                    </ListItem>
                  </Collapse>
                  <Collapse in={!signupAllowed && !loginAllowed}>
                    <ListItem
                      disabled={true}
                    >
                      <ListItemIcon><DisabledIcon /></ListItemIcon>
                      <ListItemText primary={!signupAllowed && !loginAllowed ? 'Signups are disabled' : undefined} />
                    </ListItem>
                  </Collapse>
                </List>
                <div
                  className={this.props.classes.accountFieldsContainer}
                  style={{
                    maxWidth: showAccountFields ? '400px' : '0px',
                    maxHeight: showAccountFields ? '400px' : '0px',
                  }}
                >
                  {!singleColumnLayout && (<Hr vertical length='25%' />)}
                  <div>
                    <ListSubheader className={this.props.classes.noWrap} component="div">Your info</ListSubheader>
                    {showDisplayNameInput && (
                      <TextField
                        fullWidth
                        required={isDisplayNameRequired}
                        value={this.state.displayName || ''}
                        onChange={e => this.setState({ displayName: e.target.value })}
                        label='Display name'
                        helperText={(<span className={this.props.classes.noWrap}>How others see you</span>)}
                        margin='normal'
                        classes={{ root: this.props.classes.noWrap }}
                        style={{ marginTop: '0px' }}
                        disabled={this.state.isSubmitting}
                      />
                    )}
                    <Collapse in={showEmailInput} unmountOnExit>
                      <div>
                        <TextField
                          fullWidth
                          required
                          value={this.state.email || ''}
                          onChange={e => this.setState({ email: e.target.value })}
                          label='Email'
                          type='email'
                          helperText={(<span className={this.props.classes.noWrap}>Where to send you updates</span>)}
                          margin='normal'
                          style={{ marginTop: showDisplayNameInput ? undefined : '0px' }}
                          disabled={this.state.isSubmitting}
                        />
                        {showPasswordInput && (
                          <TextField
                            fullWidth
                            required={isPasswordRequired}
                            value={this.state.pass || ''}
                            onChange={e => this.setState({ pass: e.target.value })}
                            label='Password'
                            helperText={(<span className={this.props.classes.noWrap}>
                              {isPasswordRequired
                                ? 'Secure your account'
                                : 'Optionally secure your account'}
                            </span>)}
                            type={this.state.revealPassword ? 'text' : 'password'}
                            InputProps={{
                              endAdornment: (
                                <InputAdornment position='end'>
                                  <IconButton
                                    aria-label='Toggle password visibility'
                                    onClick={() => this.setState({ revealPassword: !this.state.revealPassword })}
                                  >
                                    {this.state.revealPassword ? <VisibilityIcon fontSize='small' /> : <VisibilityOffIcon fontSize='small' />}
                                  </IconButton>
                                </InputAdornment>
                              )
                            }}
                            margin='normal'
                            disabled={this.state.isSubmitting}
                          />
                        )}
                      </div>
                    </Collapse>
                  </div>
                </div>
              </div>
              {(signupAllowed || loginAllowed) && (
                <AcceptTerms overrideTerms={this.props.config?.users.onboarding.terms?.documents} />
              )}
            </Collapse>
            <Collapse in={!!isLogin}>
              <div className={this.props.classes.loginFieldsContainer}>
                <ListSubheader className={this.props.classes.noWrap} component="div">Login</ListSubheader>
                <div>
                  <TextField
                    fullWidth
                    required
                    value={this.state.email || ''}
                    onChange={e => this.setState({ email: e.target.value })}
                    label='Email'
                    type='email'
                    helperText={(<span className={this.props.classes.noWrap}>Email you used to sign up</span>)}
                    margin='normal'
                    style={{ marginTop: '0px' }}
                    disabled={this.state.isSubmitting}
                  />
                  <TextField
                    fullWidth
                    value={this.state.pass || ''}
                    onChange={e => this.setState({ pass: e.target.value })}
                    label='Password'
                    helperText={(<span className={this.props.classes.noWrap}>Leave blank if you forgot</span>)}
                    type={this.state.revealPassword ? 'text' : 'password'}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position='end'>
                          <IconButton
                            aria-label='Toggle password visibility'
                            onClick={() => this.setState({ revealPassword: !this.state.revealPassword })}
                          >
                            {this.state.revealPassword ? <VisibilityIcon fontSize='small' /> : <VisibilityOffIcon fontSize='small' />}
                          </IconButton>
                        </InputAdornment>
                      )
                    }}
                    margin='normal'
                    disabled={this.state.isSubmitting}
                  />
                </div>
              </div>
            </Collapse>
          </DialogContent>
          <DialogActions>
            {!!loginAllowed && !!signupAllowed && (
              <SubmitButton
                onClick={() => this.setState({ isLogin: !isLogin })}
                isSubmitting={this.state.isSubmitting}
              >{isLogin ? 'Or Signup' : 'Or Login'}</SubmitButton>
            )}
            {(signupAllowed || loginAllowed) ? (
              <SubmitButton
                color='primary'
                isSubmitting={this.state.isSubmitting}
                disabled={!isSubmittable}
                onClick={() => {
                  if (!!isLogin && !this.state.pass) {
                    this.listenForExternalBind();
                    this.setState({ awaitExternalBind: 'recovery' });
                    this.props.server.dispatch().forgotPassword({
                      projectId: this.props.server.getProjectId(),
                      forgotPassword: {
                        email: this.state.email!,
                      },
                    });
                  } else if (!!isLogin && !!this.state.pass) {
                    this.setState({ isSubmitting: true });
                    this.props.server.dispatch().userLogin({
                      projectId: this.props.server.getProjectId(),
                      userLogin: {
                        email: this.state.email!,
                        password: saltHashPassword(this.state.pass),
                      },
                    }).then(() => {
                      this.setState({ isSubmitting: false });
                      this.props.onLoggedInAndClose();
                    }).catch(() => {
                      this.setState({ isSubmitting: false });
                    });
                  } else {
                    this.setState({ isSubmitting: true });
                    this.props.server.dispatch().userCreate({
                      projectId: this.props.server.getProjectId(),
                      userCreate: {
                        name: this.state.displayName,
                        email: this.state.email,
                        password: this.state.pass ? saltHashPassword(this.state.pass) : undefined,
                        iosPushToken: selectedNotificationType === NotificationType.Ios ? this.state.notificationDataIos : undefined,
                        androidPushToken: selectedNotificationType === NotificationType.Android ? this.state.notificationDataAndroid : undefined,
                        browserPushToken: selectedNotificationType === NotificationType.Browser ? this.state.notificationDataBrowser : undefined,
                      },
                    }).then(() => {
                      this.setState({ isSubmitting: false });
                      this.props.onLoggedInAndClose();
                    }).catch(() => {
                      this.setState({ isSubmitting: false });
                    });
                  }
                }}
              >Continue</SubmitButton>
            ) : (
                <Button onClick={() => { this.props.onClose() }}>Back</Button>
              )}
          </DialogActions>
          <Dialog
            open={!!this.state.awaitExternalBind}
            onClose={() => this.setState({ awaitExternalBind: undefined })}
            maxWidth='xs'
            {...this.props.forgotEmailDialogProps}
          >
            <DialogTitle>
              {this.state.awaitExternalBind === 'recovery'
                ? 'Awaiting confirmation...'
                : 'Awaiting confirmation...'}
            </DialogTitle>
            <DialogContent>
              {this.state.awaitExternalBind === 'recovery' ? (
                <DialogContentText>We sent an email to <span className={this.props.classes.bold}>{this.state.email}</span>. Return to this page after clicking the confirmation link.</DialogContentText>
              ) : (
                  <DialogContentText>A popup was opened leading you to a signup page. After you complete sign up, this dialog will automatically close.</DialogContentText>
                )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => this.setState({ awaitExternalBind: undefined })}>Cancel</Button>
            </DialogActions>
          </Dialog>
        </React.Fragment>
      );
    }

    return (
      <Dialog
        open={!!this.props.open}
        onClose={this.props.onClose}
        scroll='body'
        PaperProps={{
          style: {
            width: 'fit-content',
            marginLeft: 'auto',
            marginRight: 'auto',
          },
        }}
        {...this.props.DialogProps}
      >
        {dialogContent}
      </Dialog>
    );
  }

  listenForExternalBind() {
    if (this.storageListener) return;
    this.storageListener = (ev: StorageEvent) => {
      if (ev.key !== BIND_SUCCESS_LOCALSTORAGE_EVENT_KEY) return;
      this.props.server.dispatch().userBind({
        projectId: this.props.server.getProjectId(),
      });
    }
    window.addEventListener('storage', this.storageListener);
  }

  onClickSsoNotif() {
    if (!this.props.config?.users.onboarding.notificationMethods.sso?.redirectUrl) return;
    this.listenForExternalBind();
    this.setState({ awaitExternalBind: 'sso' });
    window.open(this.props.config.users.onboarding.notificationMethods.sso.redirectUrl
      .replace('<return_uri>', `${window.location.protocol}//${window.location.host}/sso`),
      `cf_${this.props.config.projectId}_sso`,
      `width=${document.documentElement.clientWidth * 0.9},height=${document.documentElement.clientHeight * 0.9}`,
    );
  }

  onClickMobileNotif() {
    const device = (this.props.overrideMobileNotification || MobileNotification.getInstance()).getDevice();
    if (device === Device.None) return;
    this.setState({
      notificationType: device === Device.Android ? NotificationType.Android : NotificationType.Ios,
    });
    (this.props.overrideMobileNotification || MobileNotification.getInstance()).askPermission().then(r => {
      if (r.type === 'success') {
        this.setState({
          ...(r.device === Device.Android ? { notificationDataAndroid: r.token } : {}),
          ...(r.device === Device.Ios ? { notificationDataIos: r.token } : {}),
        });
      } else if (r.type === 'error') {
        if (r.userFacingMsg) {
          this.props.enqueueSnackbar(r.userFacingMsg || 'Failed to setup mobile push', { variant: 'error', preventDuplicate: true });
        }
        this.forceUpdate();
      }
    })
  }

  onClickWebNotif() {
    this.setState({
      notificationType: NotificationType.Browser,
    });
    (this.props.overrideWebNotification || WebNotification.getInstance()).askPermission().then(r => {
      if (r.type === 'success') {
        this.setState({
          notificationDataBrowser: r.token,
        });
      } else if (r.type === 'error') {
        if (r.userFacingMsg) {
          this.props.enqueueSnackbar(r.userFacingMsg || 'Failed to setup browser notifications', { variant: 'error', preventDuplicate: true });
        }
        this.forceUpdate();
      }
    });
  }
}

export default connect<ConnectProps, {}, Props, ReduxState>((state, ownProps) => {
  return {
    configver: state.conf.ver, // force rerender on config change
    config: state.conf.conf,
    loggedInUser: state.users.loggedIn.status === Status.FULFILLED ? state.users.loggedIn.user : undefined,
  }
})(withStyles(styles, { withTheme: true })(withSnackbar(withMobileDialog<Props & ConnectProps & WithStyles<typeof styles, true> & WithSnackbarProps>({ breakpoint: 'xs' })(LogIn))));
