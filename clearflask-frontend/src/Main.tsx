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
                <Route exact path="/" render={props => (
                  <Provider store={ServerAdmin.get().getStore()}>
                    <Site {...props} />
                  </Provider>
                )} />
                <Route path="/(pricing|demo|signup|contact|login|terms|terms-of-service|privacy|policy|privacy-policy)" render={props => (
                  <Provider store={ServerAdmin.get().getStore()}>
                    <Site {...props} />
                  </Provider>
                )} />
                <Route path="/dashboard/:path?/:subPath*" render={props => (
                  <Provider store={ServerAdmin.get().getStore()}>
                    <Dashboard {...props} />
                  </Provider>
                )} />
                <Route path="/:projectId" render={props => (
                  <App {...props} />
                )} />
              </Switch>
            </Router>
          </div>
        </MuiSnackbarProvider>
      </MuiThemeProvider>
      // </React.StrictMode>
    );
  }
}

export default Main;
