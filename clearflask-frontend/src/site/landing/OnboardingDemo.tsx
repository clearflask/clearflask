import React, { Component } from 'react';
import { withStyles, Theme, createStyles, WithStyles } from '@material-ui/core/styles';
import * as ConfigEditor from '../../common/config/configEditor';
import Templater from '../../common/config/configTemplater';
import { ToggleButtonGroup, ToggleButton } from '@material-ui/lab';
import { Grow, RadioGroup, FormControlLabel, Radio, Switch, FormHelperText, Button } from '@material-ui/core';
import LogIn from '../../app/comps/LogIn';
import { Server } from '../../api/server';
import { Provider } from 'react-redux';
import AppThemeProvider from '../../app/AppThemeProvider';
import MobileNotification from '../../common/notification/mobileNotification';
import WebNotification from '../../common/notification/webNotification';
import DeviceContainer, { Device } from '../../common/DeviceContainer';

const styles = (theme:Theme) => createStyles({
  page: {
    position: 'relative',
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginDialog: {
    position: 'relative' + '!important' as 'relative',
    width: '100%',
  },
  loginPaperScrollBody: {
    marginBottom: 65, // Extend to show shadow
  },
});

interface Props {
  server: Server;
}

interface State {
  loginOpen:boolean;
}

class OnboardingDemo extends Component<Props&WithStyles<typeof styles, true>, State> {
  state:State = {
    loginOpen: true,
  };

  render() {
    return (
      <Provider store={this.props.server.getStore()}>
      <AppThemeProvider appRootId='onboardingDemo' isInsideContainer={true} supressCssBaseline={true}>
          <DeviceContainer device={Device.Mobile}>
        <div id='onboardingDemo' className={this.props.classes.page}>
            {this.state.loginOpen ? (
              <LogIn
                server={this.props.server}
                open={this.state.loginOpen}
                onClose={() => this.setState({loginOpen: false})}
                onLoggedInAndClose={() => this.setState({loginOpen: false})}
                overrideMobileNotification={MobileNotification.getMockInstance()}
                overrideWebNotification={WebNotification.getMockInstance()}
                DialogProps={{
                  // hideBackdrop: true,
                  disablePortal: true,
                  disableBackdropClick: true,
                  disableEscapeKeyDown: true,
                  classes: {
                    root: this.props.classes.loginDialog,
                    paperScrollBody: this.props.classes.loginPaperScrollBody,
                  },
                }}
              />
            ) : (
              <Button
                onClick={() => this.props.server.dispatch().userLogout({projectId: this.props.server.getProjectId()})
                  .then(() => this.setState({loginOpen: true}))}
              >Try again</Button>
            )}
        </div>
          </DeviceContainer>
      </AppThemeProvider>
      </Provider>
    );
  }
}

export default withStyles(styles, { withTheme: true })(OnboardingDemo);
