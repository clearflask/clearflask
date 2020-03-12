import { createMuiTheme, Theme } from '@material-ui/core';
import CssBaseline from '@material-ui/core/CssBaseline';
import { MuiThemeProvider } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { Provider } from 'react-redux';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
import ServerAdmin from './api/serverAdmin';
import App from './app/App';
import CaptchaChallenger from './app/utils/CaptchaChallenger';
import EnvironmentNotifier from './app/utils/EnvironmentNotifier';
import MuiSnackbarProvider from './app/utils/MuiSnackbarProvider';
import ServerErrorNotifier from './app/utils/ServerErrorNotifier';
import { closeLoadingScreen } from './common/loadingScreen';
import { detectEnv, Environment } from './common/util/detectEnv';
import ScrollToTop from './ScrollToTop';
import Dashboard from './site/Dashboard';
import Site from './site/Site';

const theme: Theme = createMuiTheme({
  palette: {
    // type: 'dark',
    background: {
      default: '#fff',
      paper: '#fff',
    }
  },
  overrides: {
    MuiAppBar: {
      colorDefault: {
        backgroundColor: '#fff',
      },
    }
  },
});

class Main extends Component {
  componentDidMount() {
    closeLoadingScreen();
  }

  render() {
    const subdomain = this.getSubdomain();
    return (
      // <React.StrictMode>
      <MuiThemeProvider theme={theme}>
        <MuiSnackbarProvider>
          <CssBaseline />
          <EnvironmentNotifier />
          <ServerErrorNotifier server={ServerAdmin.get()} />
          <CaptchaChallenger server={ServerAdmin.get()} />
          <div style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            background: theme.palette.background.default,
          }}>
            <Router>
              <ScrollToTop />
              <Switch>
                {subdomain ? (
                  <Route path="/" render={props => (
                    <App projectId={subdomain} {...props} />
                  )} />
                ) : (
                    <React.Fragment>
                      <Route path="/dashboard/:path?/:subPath*" render={props => (
                        <Provider store={ServerAdmin.get().getStore()}>
                          <Dashboard {...props} />
                        </Provider>
                      )} />
                      <Route render={props => (
                        <Provider store={ServerAdmin.get().getStore()}>
                          <Site {...props} />
                        </Provider>
                      )} />
                    </React.Fragment>
                  )}
              </Switch>
            </Router>
          </div>
        </MuiSnackbarProvider>
      </MuiThemeProvider>
      // </React.StrictMode>
    );
  }

  getSubdomain(): string | undefined {
    const hostSplit = window.location.host.split('.');
    var subdomain: string | undefined = undefined;
    switch (detectEnv()) {
      case Environment.PRODUCTION:
        if (hostSplit.length === 3) {
          subdomain = hostSplit[0];
        }
        break;
      case Environment.DEVELOPMENT_FRONTEND:
      case Environment.DEVELOPMENT_LOCAL:
        if (hostSplit.length === 2) {
          subdomain = hostSplit[0];
        }
        break;
    }
    return subdomain;
  }
}

export default Main;
