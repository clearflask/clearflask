import { Button } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { Provider } from 'react-redux';
import { Server } from '../../api/server';
import AppThemeProvider from '../../app/AppThemeProvider';
import LogIn from '../../app/comps/LogIn';
import DemoPushPermissionDialog from '../../common/DemoPushPermissionDialog';
import DeviceContainer, { Device } from '../../common/DeviceContainer';
import MobileNotification, { Device as MobileDevice, Status as MobileStatus } from '../../common/notification/mobileNotification';
import WebNotification, { Status as WebStatus } from '../../common/notification/webNotification';

const styles = (theme: Theme) => createStyles({
  content: {
    position: 'relative',
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginDialog: {
    position: 'relative!important' as any,
    width: '100%',
    height: '100%',
  },
  loginPaperScrollBody: {
    marginBottom: 65, // Extend to show shadow
  },
});

interface Props {
  server: Server;
}

interface State {
  loginOpen: boolean;
  device: Device;
}

class OnboardingDemo extends Component<Props & WithStyles<typeof styles, true>, State> {
  state: State = {
    loginOpen: true,
    device: Device.Desktop,
  };
  mobileNotification = MobileNotification.getMockInstance();
  mobileNotificationNotSupported = MobileNotification.getMockInstance(MobileStatus.Disconnected);
  webNotification = WebNotification.getMockInstance();
  webNotificationNotSupported = WebNotification.getMockInstance(WebStatus.Unsupported);

  render() {
    return (
      <DeviceContainer key={this.state.device} device={this.state.device}>
        <DemoPushPermissionDialog
          mobileNotification={this.mobileNotification}
          webNotification={this.webNotification}
        >
          <Provider store={this.props.server.getStore()}>
            <AppThemeProvider
              appRootId='onboardingDemo'
              isInsideContainer={true}
              supressCssBaseline={true}
              breakpoints={this.state.device === Device.Mobile ? {
                'xs': 0,
                'sm': 10000,
                'md': 10000,
                'lg': 10000,
                'xl': 10000,
              } : undefined}
            >
              <div id='onboardingDemo' className={this.props.classes.content}>
                {this.state.loginOpen ? (
                  <LogIn
                    server={this.props.server}
                    open={this.state.loginOpen}
                    onClose={() => this.setState({ loginOpen: false })}
                    onLoggedInAndClose={() => this.setState({ loginOpen: false })}
                    overrideMobileNotification={this.state.device === Device.Mobile ? this.mobileNotification : this.mobileNotificationNotSupported}
                    overrideWebNotification={this.state.device === Device.Desktop ? this.webNotification : this.webNotificationNotSupported}
                    DialogProps={{
                      disablePortal: true,
                      disableBackdropClick: true,
                      disableEscapeKeyDown: true,
                      disableAutoFocus: true,
                      classes: {
                        root: this.props.classes.loginDialog,
                        paperScrollBody: this.props.classes.loginPaperScrollBody,
                      },
                    }}
                  />
                ) : (
                    <Button
                      onClick={() => this.props.server.dispatch().userLogout({ projectId: this.props.server.getProjectId() })
                        .then(() => {
                          this.mobileNotification.mockSetStatus(MobileStatus.Available);
                          this.mobileNotification.mockSetDevice(MobileDevice.Ios);
                          this.webNotification.mockSetStatus(WebStatus.Available);
                          this.setState({ loginOpen: true })
                        })}
                    >Try again</Button>
                  )}
              </div>
            </AppThemeProvider>
          </Provider>
        </DemoPushPermissionDialog>
      </DeviceContainer>
    );
  }

  /** Called externally by OnboardingControls */
  onDeviceChange(device: Device) {
    this.setState({ device: device });
  }
}

export default withStyles(styles, { withTheme: true })(OnboardingDemo);
