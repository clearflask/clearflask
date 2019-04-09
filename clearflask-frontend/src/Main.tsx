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
import { MuiThemeProvider, createMuiTheme, Theme } from '@material-ui/core';
import Admin from './site/Admin';

const theme:Theme = createMuiTheme({
  palette: {
    // type: 'dark',
  },
});

class Main extends Component {
  render() {
    return (
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        <Router>
          <Switch>
            <Route path="/" exact render={props => (
              <Site {...props} />
            )} />
            <Route path="/admin/:projectId?/:path*" render={props => (
              <Admin {...props} />
            )} />
            <Route path="/:projectId/:pageUrlName?" render={props => (
              <App {...props} />
            )} />
          </Switch>
        </Router>
      </MuiThemeProvider>
    );
  }
}

export default Main;
