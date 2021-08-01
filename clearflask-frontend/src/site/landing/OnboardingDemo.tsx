// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { Button } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { Provider } from 'react-redux';
import { Server } from '../../api/server';
import AppThemeProvider from '../../app/AppThemeProvider';
import LogIn from '../../app/comps/LogIn';
import ErrorPage from '../../app/ErrorPage';
import DemoPushPermissionDialog from '../../common/DemoPushPermissionDialog';
import DeviceContainer, { Device } from '../../common/DeviceContainer';
import FakeBrowser from '../../common/FakeBrowser';
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
  tryAgainButton: {
    paddingTop: 0,
    paddingBottom: 0,
    marginLeft: 10,
  },
  tryAgainContainer: {
    display: 'flex',
    alignItems: 'center',
  },
  desktopBrowser: {
    borderRadius: 0,
    height: '100%',
  },
});

interface Props {
  server: Server;
  defaultDevice: Device;
}

interface State {
  loginOpen: boolean;
  device: Device;
}

class OnboardingDemo extends Component<Props & WithStyles<typeof styles, true>, State> {
  mobileNotification = MobileNotification.getMockInstance();
  mobileNotificationNotSupported = MobileNotification.getMockInstance(MobileStatus.Disconnected);
  webNotification = WebNotification.getMockInstance();
  webNotificationNotSupported = WebNotification.getMockInstance(WebStatus.Unsupported);

  constructor(props) {
    super(props);

    this.state = {
      loginOpen: true,
      device: this.props.defaultDevice,
    };
  }

  render() {
    const loggedIn = !!this.props.server.getStore().getState().users.loggedIn.user;
    var content = (
      <DemoPushPermissionDialog
        mobileNotification={this.mobileNotification}
        webNotification={this.webNotification}
      >
        <Provider store={this.props.server.getStore()}>
          <AppThemeProvider
            appRootId='onboardingDemo'
            seed='onboardingDemo'
            isInsideContainer={true}
            supressCssBaseline={true}
            forceBreakpoint={this.state.device === Device.Mobile ? 'xs' : undefined}
          >
            <div id='onboardingDemo' className={this.props.classes.content}>
              {this.state.loginOpen ? (
                <LogIn
                  actionTitle='Create account'
                  server={this.props.server}
                  open={this.state.loginOpen}
                  onClose={() => this.setState({ loginOpen: false })}
                  onLoggedInAndClose={() => this.setState({ loginOpen: false })}
                  overrideMobileNotification={this.state.device === Device.Mobile ? this.mobileNotification : this.mobileNotificationNotSupported}
                  overrideWebNotification={(this.state.device === Device.Desktop || this.state.device === Device.None) ? this.webNotification : this.webNotificationNotSupported}
                  DialogProps={{
                    disablePortal: true,
                    disableBackdropClick: true,
                    disableEscapeKeyDown: true,
                    hideBackdrop: this.state.device === Device.None,
                    disableAutoFocus: true,
                    classes: {
                      root: this.props.classes.loginDialog,
                      paperScrollBody: this.props.classes.loginPaperScrollBody,
                    },
                  }}
                  forgotEmailDialogProps={{
                    disableBackdropClick: true,
                    disableEscapeKeyDown: true,
                    hideBackdrop: this.state.device === Device.None,
                  }}
                />
              ) : (
                <ErrorPage msg={(
                  <div className={this.props.classes.tryAgainContainer}>
                    {loggedIn ? 'Successfully logged in' : 'Failed to login'}
                    <Button
                      className={this.props.classes.tryAgainButton}
                      onClick={() => this.props.server.dispatch().then(d => d.userLogout({
                        projectId: this.props.server.getProjectId(),
                      }))
                        .then(() => {
                          this.mobileNotification.mockSetStatus(MobileStatus.Available);
                          this.mobileNotification.mockSetDevice(MobileDevice.Ios);
                          this.webNotification.mockSetStatus(WebStatus.Available);
                          this.setState({ loginOpen: true })
                        })}
                    >Try again</Button>
                  </div>
                )} variant={loggedIn ? 'success' : 'error'} />
              )}
            </div>
          </AppThemeProvider>
        </Provider>
      </DemoPushPermissionDialog>
    );
    if (this.state.device === Device.Desktop) {
      content = (
        <FakeBrowser darkMode fixedHeight='100%' className={this.props.classes.desktopBrowser}>
          {content}
        </FakeBrowser>
      );
    }
    content = (
      <DeviceContainer key={this.state.device} device={this.state.device}>
        {content}
      </DeviceContainer>
    );
    return content;
  }

  /** Called externally by OnboardingControls */
  onDeviceChange(device: Device) {
    this.setState({ device: device });
  }
}

export default withStyles(styles, { withTheme: true })(OnboardingDemo);
