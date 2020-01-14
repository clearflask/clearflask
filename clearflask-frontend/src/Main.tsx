import React, { Component } from 'react';
import {
  BrowserRouter as Router,
  Route,
  Switch,
} from 'react-router-dom'
import App from './app/App';
import Site from './site/Site';
import CssBaseline from '@material-ui/core/CssBaseline';
import { createMuiTheme, Theme } from '@material-ui/core';
import Dashboard from './site/Dashboard';
import {closeLoadingScreen} from './common/loadingScreen';
import MuiSnackbarProvider from './app/utils/MuiSnackbarProvider';
import { MuiThemeProvider } from '@material-ui/core/styles';
import { Provider } from 'react-redux';
import ServerAdmin from './api/serverAdmin';
import ServerErrorNotifier from './app/utils/ServerErrorNotifier';
import CaptchaChallenger from './app/utils/CaptchaChallenger';

const theme:Theme = createMuiTheme({
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
        <ServerErrorNotifier server={ServerAdmin.get()} />
        <CaptchaChallenger server={ServerAdmin.get()} />
        <div style={{background: theme.palette.background.default}}>
          <Router>
            <Switch>
              <Route exact path="/" render={props => (
                <Provider store={ServerAdmin.get().getStore()}>
                  <Site {...props} />
                </Provider>
              )} />
              <Route path="/(pricing|demo|signup|login)" render={props => (
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
