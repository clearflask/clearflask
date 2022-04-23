// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { Button } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { RouteComponentProps, withRouter } from 'react-router';
import { OAuthFlow } from '../common/util/oauthUtil';
import windowIso from '../common/windowIso';
import { SSO_TOKEN_PARAM_NAME } from './App';
import ErrorPage from './ErrorPage';

const styles = (theme: Theme) => createStyles({
  loginButton: {
    paddingTop: 0,
    paddingBottom: 0,
    marginLeft: 10,
  },
  loginContainer: {
    display: 'flex',
    alignItems: 'center',
  },
});
interface Props {
  type: 'sso' | 'oauth';
}
interface State {
  fakeLoggedIn?: boolean;
}
class DemoOnboardingLogin extends Component<Props & RouteComponentProps & WithStyles<typeof styles, true>, State> {
  state: State = {};
  render() {
    const token = new URL(windowIso.location.href).searchParams.get(SSO_TOKEN_PARAM_NAME);
    if (token) {
      // Clear token from URL for safety
      this.props.history.replace(this.props.location.pathname);
    }

    if (!this.state.fakeLoggedIn) {
      return (<ErrorPage msg={(
        <div className={this.props.classes.loginContainer}>
          This is a demo login page for {this.props.type === 'sso' ? 'Single Sign-On' : 'OAuth'}
          <Button
            className={this.props.classes.loginButton}
            size='small'
            onClick={() => {
              this.setState({ fakeLoggedIn: true });

              // Broadcast to onboarding demo that login was successfully faked
              const oauthFlow = new OAuthFlow({ accountType: 'user', redirectPath: '/oauth-demo' });
              oauthFlow.broadcastSuccess();

              // Close window
              !windowIso.isSsr && windowIso.self.close();
            }}
          >LOGIN</Button>
        </div>
      )} variant='info' />);
    } else {
      return (<ErrorPage msg='Successfully logged in' variant='success' />);
    }
  }
}

export default withStyles(styles, { withTheme: true })(withRouter(DemoOnboardingLogin));
