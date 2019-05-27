import React, { Component } from 'react';
import {
  BrowserRouter as Router,
  Route,
  Switch,
  Redirect,
} from 'react-router-dom'
import App from './app/App';
import Site from './site/Site';
import CssBaseline from '@material-ui/core/CssBaseline';
import { createMuiTheme, Theme } from '@material-ui/core';
import Admin from './site/Admin';
import {closeLoadingScreen} from './common/loadingScreen';
import MuiSnackbarProvider from './app/utils/MuiSnackbarProvider';
import { MuiThemeProvider } from '@material-ui/core/styles';

const theme:Theme = createMuiTheme({
  palette: {
    // type: 'dark',
  },
});

class Main extends Component {
  componentDidMount() {
    closeLoadingScreen();
  }

  render() {
    return (
      <React.StrictMode>
      <MuiThemeProvider theme={theme}>
      <MuiSnackbarProvider>
        <CssBaseline />
        <div style={{background: theme.palette.background.default}}>
          <Router>
            <Switch>
              <Route path="/" exact render={props => (
                <Site {...props} />
              )} />
              <Route path="/admin/:path?/:subPath*" render={props => (
                <Admin {...props} />
              )} />
              <Route path="/:projectId" render={props => (
                <App {...props} />
              )} />
            </Switch>
          </Router>
        </div>
      </MuiSnackbarProvider>
      </MuiThemeProvider>
      </React.StrictMode>
    );
  }
}

export default Main;
