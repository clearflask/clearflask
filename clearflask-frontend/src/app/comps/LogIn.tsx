import React, { Component } from 'react';
import * as Client from '../../api/client';
import { withStyles, Theme, createStyles, WithStyles } from '@material-ui/core/styles';
import { Typography, TextField, Button, List, ListItem, ListItemIcon, ListItemText, ListSubheader, Collapse, Dialog, DialogContent, DialogActions, InputAdornment, IconButton } from '@material-ui/core';
import Delimited from '../utils/Delimited';
import { connect } from 'react-redux';
import { Server, ReduxState, Status } from '../../api/server';
import Hr from '../../common/Hr';
import SilentIcon from '@material-ui/icons/NotificationsOff';
import EmailIcon from '@material-ui/icons/Email';
/** Alternatives: PhonelinkRing, Vibration */
import MobilePushIcon from '@material-ui/icons/PhonelinkRing';
/** Alternatives: NotificationsActive, Web */
import WebPushIcon from '@material-ui/icons/NotificationsActive';
import WebNotification from '../../common/notification/webNotification';
import MobileNotification from '../../common/notification/mobileNotification';
import { withSnackbar, WithSnackbarProps } from 'notistack';
import withMobileDialog, { InjectedProps } from '@material-ui/core/withMobileDialog';
import { WithWidth } from '@material-ui/core/withWidth';
import VisibilityIcon from '@material-ui/icons/Visibility';
import VisibilityOffIcon from '@material-ui/icons/VisibilityOff';
type WithMobileDialogProps = InjectedProps & Partial<WithWidth>;

enum NotificationType {
  Email = 'email',
  Web = 'web',
  Mobile = 'mobile',
  Silent = 'silent',
}

const styles = (theme:Theme) => createStyles({
  content: {
    display: 'flex',
    [theme.breakpoints.down('sm')]: {
      flexDirection: 'column',
    },
  },
  dividerVertical: {
    [theme.breakpoints.down('sm')]: {
      display: 'none',
    },
  },
  accountFieldsContainer: {
    display: 'flex',
    transition: theme.transitions.create(['max-width', 'max-height']),
    width: 'min-content',
  },
  noWrap: {
    whiteSpace: 'nowrap',
  },
});

export interface Props {
  server:Server;
  open?:boolean;
  onClose:()=>void;
  onLoggedIn:()=>void;
}

interface ConnectProps {
  configver?:string;
  config?:Client.Config;
}

interface State {
  open?:boolean;
  notificationType?:NotificationType
  notificationData?:any
  displayName?:string;
  email?:string;
  pass?:string;
  revealPassword?:boolean;
}

class LogIn extends Component<Props&ConnectProps&WithStyles<typeof styles, true>&WithSnackbarProps&WithMobileDialogProps, State> {
  state:State={};

  render() {
    const notifOpts:Set<NotificationType> = new Set();
    if(this.props.config) {
      if(this.props.config.users.onboarding.notificationMethods.mobilePush === true
        && MobileNotification.getInstance().canAskPermission()) {
        notifOpts.add(NotificationType.Mobile);
      }
      if(this.props.config.users.onboarding.notificationMethods.browserPush === true
        && WebNotification.getInstance().canAskPermission()) {
        notifOpts.add(NotificationType.Web);
      }
      if(this.props.config.users.onboarding.notificationMethods.anonymous
        && (this.props.config.users.onboarding.notificationMethods.anonymous.onlyShowIfPushNotAvailable !== true
          || (!notifOpts.has(NotificationType.Mobile) && !notifOpts.has(NotificationType.Web)))) {
        notifOpts.add(NotificationType.Silent)
      }
      if(this.props.config.users.onboarding.notificationMethods.email) {
        notifOpts.add(NotificationType.Email);
      }
    }

    const showEmailInput = this.state.notificationType === NotificationType.Email;
    const showDisplayNameInput = this.props.config && this.props.config.users.onboarding.accountFields.displayName !== Client.AccountFieldsDisplayNameEnum.None;
    const showAccountFields = showEmailInput || showDisplayNameInput;
    const isSubmittable = this.state.notificationType && (
      (this.state.notificationType !== NotificationType.Mobile && this.state.notificationType !== NotificationType.Web)
      || this.state.notificationData);

    return (
      <Dialog
        fullScreen={this.props.fullScreen}
        open={!!this.props.open}
        onClose={this.props.onClose}
        scroll='body'
        PaperProps={{
          style: { width: !this.props.fullScreen ? 'fit-content' : undefined },
        }}
      >
        <DialogContent>
          <div className={this.props.classes.content}>
            <List
              component="nav"
              subheader={<ListSubheader className={this.props.classes.noWrap} component="div">Get notified on changes by</ListSubheader>}
            >
              <Collapse in={notifOpts.has(NotificationType.Email)}>
                <ListItem 
                  button
                  selected={this.state.notificationType === NotificationType.Email}
                  onClick={e => this.setState({notificationType: NotificationType.Email})}
                >
                  <ListItemIcon><EmailIcon /></ListItemIcon>
                  <ListItemText inset primary='Email' className={this.props.classes.noWrap} />
                </ListItem>
              </Collapse>
              <Collapse in={notifOpts.has(NotificationType.Mobile)}>
                <ListItem
                  button
                  selected={this.state.notificationType === NotificationType.Mobile}
                  onClick={this.onClickMobileNotif.bind(this)}
                >
                  <ListItemIcon><MobilePushIcon /></ListItemIcon>
                  <ListItemText inset primary='Mobile push' className={this.props.classes.noWrap} />
                </ListItem>
              </Collapse>
              <Collapse in={notifOpts.has(NotificationType.Web)}>
                <ListItem 
                  button
                  selected={this.state.notificationType === NotificationType.Web}
                  onClick={this.onClickWebNotif.bind(this)}
                >
                  <ListItemIcon><WebPushIcon /></ListItemIcon>
                  <ListItemText inset primary='Browser Push' className={this.props.classes.noWrap} />
                </ListItem>
              </Collapse>
              <Collapse in={notifOpts.has(NotificationType.Silent)}>
                <ListItem 
                  button
                  selected={this.state.notificationType === NotificationType.Silent}
                  onClick={e => this.setState({notificationType: NotificationType.Silent})}
                >
                  <ListItemIcon><SilentIcon /></ListItemIcon>
                  <ListItemText inset primary="Silent" />
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
              <Hr className={this.props.classes.dividerVertical} vertical length='25%' />
              <div>
                <ListSubheader className={this.props.classes.noWrap} component="div">Account information</ListSubheader>
                {showDisplayNameInput && (
                  <div>
                    <TextField
                      fullWidth
                      required={this.props.config && this.props.config.users.onboarding.accountFields.displayName === Client.AccountFieldsDisplayNameEnum.Required}
                      value={this.state.displayName}
                      onChange={e => this.setState({displayName: e.target.value})}
                      label='Display name'
                      helperText={(<div className={this.props.classes.noWrap}>How others see you</div>)}
                      margin='normal'
                      classes={{ root: this.props.classes.noWrap }}
                    />
                  </div>
                )}
                <Collapse in={showEmailInput} unmountOnExit>
                  <div>
                    <TextField
                      fullWidth
                      required
                      value={this.state.email}
                      onChange={e => this.setState({email: e.target.value})}
                      label='Email'
                      type='email'
                      helperText={(<div className={this.props.classes.noWrap}>Where to send you notifications</div>)}
                      margin='normal'
                    />
                    {this.props.config
                      && this.props.config.users.onboarding.notificationMethods.email
                      && this.props.config.users.onboarding.notificationMethods.email.password !== Client.EmailSignupPasswordEnum.None
                      && (
                        <TextField
                          fullWidth
                          required={this.props.config.users.onboarding.notificationMethods.email.password === Client.EmailSignupPasswordEnum.Required}
                          value={this.state.pass}
                          onChange={e => this.setState({pass: e.target.value})}
                          label='Password'
                          helperText={(<div className={this.props.classes.noWrap}>
                            {this.props.config.users.onboarding.notificationMethods.email.password === Client.EmailSignupPasswordEnum.Required
                              ? 'Secure your account'
                              : 'Optionally secure your account'}
                          </div>)}
                          type={this.state.revealPassword ? 'text' : 'password'}
                          InputProps={{ endAdornment: (
                            <InputAdornment position='end'>
                              <IconButton
                                aria-label='Toggle password visibility'
                                onClick={() => this.setState({revealPassword: !this.state.revealPassword})}
                              >
                                {this.state.revealPassword ? <VisibilityIcon fontSize='small' /> : <VisibilityOffIcon fontSize='small' />}
                              </IconButton>
                            </InputAdornment>
                          )}}
                          margin='normal'
                        />
                    )}
                  </div>
                </Collapse>
              </div>
            </div>
          </div>
        </DialogContent>
        <DialogActions>
          {this.props.fullScreen && (<Button onClick={this.props.onClose.bind(this)}>Cancel</Button>)}
          <Button color='primary' disabled={!isSubmittable}>Continue</Button>
        </DialogActions>
      </Dialog>
    );
  }

  onClickMobileNotif() {
    this.setState({
      notificationType: NotificationType.Mobile,
      notificationData: undefined,
    });
    MobileNotification.getInstance().askPermission().then(r => {
      if(r.type === 'success') {
        this.setState({
          notificationType: NotificationType.Mobile,
          notificationData: r.token,
        });
      } else if(r.type === 'error' && r.userFacingMsg) {
        this.props.enqueueSnackbar(r.userFacingMsg || 'Failed to setup mobile push', { variant: 'error', preventDuplicate: true });
        this.forceUpdate();
      }
    })
  }

  onClickWebNotif() {
    this.setState({
      notificationType: NotificationType.Web,
      notificationData: undefined,
    });
    WebNotification.getInstance().askPermission().then(r => {
      if(r.type === 'success') {
        this.setState({
          notificationType: NotificationType.Web,
          notificationData: r.token,
        });
      } else if(r.type === 'error' && r.userFacingMsg) {
        this.props.enqueueSnackbar(r.userFacingMsg || 'Failed to setup browser notifications', { variant: 'error', preventDuplicate: true });
        this.forceUpdate();
      }
    });
  }
}

export default connect<ConnectProps,{},Props,ReduxState>((state, ownProps) => {return {
  configver: state.conf.ver, // force rerender on config change
  config: state.conf.conf,
  isLoggedIn: state.users.loggedIn.status === Status.FULFILLED,
  signup: (name?:string, email?:string, password?:string):void => {ownProps.server.dispatch().userCreate({
    projectId: state.projectId,
    create: {
      name: name,
      email: email,
      password: password,
    },
  })},
}})(withStyles(styles, { withTheme: true })(withSnackbar(withMobileDialog<Props&ConnectProps&WithStyles<typeof styles, true>&WithSnackbarProps>()(LogIn))));
