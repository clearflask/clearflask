import React, { Component } from 'react';
import * as Client from '../../api/client';
import { withStyles, Theme, createStyles, WithStyles } from '@material-ui/core/styles';
import { Typography, TextField, Button, List, ListItem, ListItemIcon, ListItemText, ListSubheader, Collapse } from '@material-ui/core';
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

enum NotificationType {
  Email = 'email',
  Web = 'web',
  Mobile = 'mobile',
  Silent = 'silent',
}

const styles = (theme:Theme) => createStyles({
  content: {
    margin: theme.spacing.unit * 4,
  },
});

export interface Props {
  server:Server;
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
  email?:string;
  pass?:string;
  passRetype?:string;
}

class LogIn extends Component<Props&ConnectProps&WithStyles<typeof styles, true>&WithSnackbarProps, State> {
  state:State={};

  render() {
    return (
      <div className={this.props.classes.content}>
        <List
          component="nav"
          subheader={<ListSubheader component="div">Get notified on changes</ListSubheader>}
        >
          <Collapse in={!!this.props.config
            && !!this.props.config.users.onboarding.collectionMethods.emailSignup}>
            <ListItem 
              button
              selected={this.state.notificationType === NotificationType.Email}
              onClick={e => this.setState({notificationType: NotificationType.Email})}
            >
              <ListItemIcon>
                <EmailIcon />
              </ListItemIcon>
              <ListItemText inset primary="Email" />
            </ListItem>
          </Collapse>
          <Collapse in={!!this.props.config
            && !!this.props.config.users.onboarding.collectionMethods.mobileNotificationSignup
            && MobileNotification.getInstance().canAskPermission()}>
            <ListItem
              button
              selected={this.state.notificationType === NotificationType.Mobile}
              onClick={e => MobileNotification.getInstance().askPermission()
                .then(r => {
                  if(r.type === 'success') {
                    this.setState({
                      notificationType: NotificationType.Mobile,
                      notificationData: r.token,
                    });
                  } else {
                    this.props.enqueueSnackbar(r.userFacingMsg || 'Failed to setup mobile push', { variant: 'error', preventDuplicate: true });
                    this.forceUpdate();
                  }
                })}
            >
              <ListItemIcon>
                <MobilePushIcon />
              </ListItemIcon>
              <ListItemText inset primary="Mobile push" />
            </ListItem>
          </Collapse>
          <Collapse in={!!this.props.config
            && !!this.props.config.users.onboarding.collectionMethods.browserNotificationSignup
            && WebNotification.getInstance().canAskPermission()}>
            <ListItem 
              button
              selected={this.state.notificationType === NotificationType.Web}
              onClick={e => WebNotification.getInstance().askPermission()
                .then(r => {
                  if(r.type === 'success') {
                    this.setState({
                      notificationType: NotificationType.Web,
                      notificationData: r.token,
                    });
                  } else {
                    this.props.enqueueSnackbar(r.userFacingMsg || 'Failed to setup browser notifications', { variant: 'error', preventDuplicate: true });
                    this.forceUpdate();
                  }
                })}
            >
              <ListItemIcon>
                <WebPushIcon />
              </ListItemIcon>
              <ListItemText inset primary="Browser Push" />
            </ListItem>
          </Collapse>
            <ListItem 
              button
              selected={this.state.notificationType === NotificationType.Silent}
              onClick={e => this.setState({notificationType: NotificationType.Silent})}
            >
            <ListItemIcon>
              <SilentIcon />
            </ListItemIcon>
            <ListItemText inset primary="Silent" />
          </ListItem>
        </List>
        <div>
          <Delimited delimiter={(<Hr length='50%'>Or</Hr>)}>
            {this.props.config && this.props.config.users.onboarding.collectionMethods.singleSignOn && (
              <div></div>
            )}
            {this.props.config && this.props.config.users.onboarding.collectionMethods.emailSignup && (
              <div>
                <TextField
                  value={this.state.email}
                  onChange={e => this.setState({email: e.target.value})}
                  placeholder='Email'
                  type='email'
                />
                {this.props.config.users.onboarding.collectionMethods.emailSignup.password !== Client.EmailSignupPasswordEnum.None && (
                  <div>
                    <TextField
                      value={this.state.pass}
                      onChange={e => this.setState({pass: e.target.value})}
                      placeholder='Password'
                      type='pass'
                    />
                    <TextField
                      value={this.state.passRetype}
                      onChange={e => this.setState({passRetype: e.target.value})}
                      placeholder='Retype password'
                      type='pass'
                    />
                  </div>
                )}
              </div>
            )}
            {this.props.config && this.props.config.users.onboarding.collectionMethods.browserNotificationSignup && (
              <div>
                <Typography variant='body1'>browser notification</Typography>
                <Button color='primary'>Allow</Button>
              </div>
            )}
            {this.props.config && this.props.config.users.onboarding.collectionMethods.mobileNotificationSignup && (
              <div>
                <Typography variant='body1'>Sign up using push notifications</Typography>
                <Button color='primary'>Allow</Button>
              </div>
            )}
            {this.props.config && this.props.config.users.onboarding.collectionMethods.anonymousSignup && (
              <div>
                <Typography variant='body1'>Continue without signing up</Typography>
                <Button color='primary'>Continue</Button>
              </div>
            )}
          </Delimited>
        </div>
      </div>
    );
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
}})(withStyles(styles, { withTheme: true })(withSnackbar(LogIn)));
