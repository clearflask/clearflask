import React from 'react';
import { withStyles, Theme, createStyles, WithStyles } from '@material-ui/core/styles';
import { ThemeStyle } from '@material-ui/core/styles/createTypography';
import GradientFade from './GradientFade';
import { fade } from '@material-ui/core/styles/colorManipulator';
import { Button, IconButton, Typography, Divider } from '@material-ui/core';
import CloseIcon from '@material-ui/icons/Close';
import NotificationIcon from '@material-ui/icons/Notifications';
import MobileNotification, { Device, Status as MobileStatus, Device as MobileDevice } from './notification/mobileNotification';
import WebNotification, { Status as WebStatus } from './notification/webNotification';
import DividerVertical from '../app/utils/DividerVertical';

export enum PushDialogPlatform {
  Browser = 'browser',
  Ios = 'ios',
}

const styles = (theme:Theme) => createStyles({
  container: {
    position: 'relative',
    width: '100%',
    height: '100%',
  },
  [PushDialogPlatform.Browser]: {
    position: 'absolute',
    zIndex: 10000,
    background: theme.palette.grey[800],
    left: 25,
    top: 0,
    padding: theme.spacing(2),
    display: 'flex',
    flexDirection: 'column',
    color: theme.palette.common.white,
    '& .button': {
      color: 'rgb(146, 180, 242)',
      borderColor: theme.palette.common.white,
      textTransform: 'none',
    },
    '& .closeIcon': {
      color: theme.palette.common.white,
      marginLeft: theme.spacing(2),
      cursor: 'pointer',
    },
    '& .wantsTo, .showNotifications, .button, .closeIcon, .notificationIcon': {
      margin: theme.spacing(1),
    },
  },
  [PushDialogPlatform.Ios]: {
    position: 'absolute',
    zIndex: 10000,
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    padding: theme.spacing(2),
    display: 'flex',
    flexDirection: 'column',
    '& .dialogBorder': {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
      margin: 'auto',
      width: '80%',
      backgroundColor: 'rgba(255,255,255,0.95)',
      borderWidth: '1px',
      borderStyle: 'solid',
      borderColor: 'rgb(200, 200 ,200)',
      borderRadius: theme.spacing(2),
    },
    '& .buttonContainer': {
      width: '100%',
      display: 'flex',
      justifyContent: 'space-evenly',
    },
    '& .dividerHorizontal': {
      width: '100%',
    },
    '& .title, .buttonOk': {
      fontWeight: 'bold',
    },
    '& .buttonDont, .buttonOk': {
      color: 'rgb(73, 121, 250)',
      width: '100%',
      padding: theme.spacing(1),
    },
    '& .title, .body': {
      padding: theme.spacing(3),
    },
    '& .title': {
      paddingBottom: theme.spacing(1),
    },
    '& .body': {
      paddingTop: theme.spacing(1),
    },
  },
});

interface Props {
  mobileNotification:MobileNotification;
  webNotification:WebNotification;
}

interface State {
  open?:boolean;
  device?:PushDialogPlatform;
}

class DemoPushPermissionDialog extends React.Component<Props&WithStyles<typeof styles, true>, State> {
  state:State = {};
  onAccept:undefined|(()=>void);
  onBlock:undefined|(()=>void);

  componentWillMount() {
    this.props.mobileNotification.mockSetStatus(MobileStatus.Available);
    this.props.mobileNotification.mockSetDevice(MobileDevice.Ios);
    this.props.mobileNotification.mockSetAskPermission(() => new Promise((resolve, reject) => {
      this.setState({
        open: true,
        device: PushDialogPlatform.Ios,
      });
      this.onAccept = () => {
        this.setState({ open: false });
        this.props.mobileNotification.mockSetStatus(MobileStatus.Subscribed);
        this.props.mobileNotification.mockSetDevice(MobileDevice.Ios);
        resolve({
          type: 'success',
          device: Device.Ios,
          token:'mock-token',
        });
      };
      this.onBlock = () => {
        this.setState({ open: false });
        this.props.mobileNotification.mockSetStatus(MobileStatus.Denied);
        resolve({
          type: 'error',
        });
      };
    }));
    this.props.webNotification.mockSetStatus(WebStatus.Available);
    this.props.webNotification.mockSetAskPermission(() => new Promise((resolve, reject) => {
      this.setState({
        open: true,
        device: PushDialogPlatform.Browser,
      });
      this.onAccept = () => {
        this.setState({ open: false });
        this.props.webNotification.mockSetStatus(WebStatus.Granted);
        resolve({
          type: 'success',
          token:'mock-token',
        });
      };
      this.onBlock = () => {
        this.setState({ open: false });
        this.props.webNotification.mockSetStatus(WebStatus.Denied);
        resolve({
          type: 'error',
        });
      };
    }));
  }

  render() {
    var dialog;
    if(this.state.open && this.state.device === PushDialogPlatform.Browser) {
      dialog = (
        <div key='dialog' className={this.props.classes[PushDialogPlatform.Browser]}>
          <div style={{
            display: 'flex',
          }}>
            <div style={{
              flexGrow: 1,
              display: 'flex',
              flexDirection: 'column',
            }}>
              <div className='wantsTo'>{`${window.location} wants to`}</div>
              <div className='showNotifications' style={{
                display: 'flex',
                alignItems: 'center',
              }}>
                <NotificationIcon className='notificationIcon' fontSize='inherit' />
                <div>Show notifications</div>
              </div>
            </div>
            <CloseIcon className='closeIcon' fontSize='inherit'
              onClick={() => this.onBlock && this.onBlock()}
            />
          </div>
          <div style={{
            display: 'flex',
          }}>
            <div style={{flexGrow: 1}} />
            <Button className='button' disableRipple variant='outlined' color='primary'
              onClick={() => this.onBlock && this.onBlock()}
              >Block</Button>
            <Button className='button' disableRipple variant='outlined' color='primary'
              onClick={() => this.onAccept && this.onAccept()}
            >Allow</Button>
          </div>
        </div>
      );
    } else if(this.state.open && this.state.device === PushDialogPlatform.Ios) {
      dialog = (
        <div key='dialog' className={this.props.classes[PushDialogPlatform.Ios]}>
          <div className='dialogBorder'>
            <div className='title'>"Demo App" Would Like to Send You Notifications</div>
            <div className='body'>Notifications may include alerts, sounds, and icon badges. These can be configured in Settings</div>
            <Divider className='dividerHorizontal' />
            <div className='buttonContainer'>
              <Button className='buttonDont' disableRipple color='primary'
                onClick={() => this.onBlock && this.onBlock()}
                >Don't Allow</Button>
              <DividerVertical />
              <Button className='buttonOk' disableRipple color='primary'
                onClick={() => this.onAccept && this.onAccept()}
              >OK</Button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={this.props.classes.container}>
        {this.props.children}
        {dialog}
      </div>
    );
  }
}

export default withStyles(styles, { withTheme: true })(DemoPushPermissionDialog);
