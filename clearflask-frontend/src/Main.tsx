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

class Main extends Component {
  render() {
    return (
      <Router>
        <CssBaseline />
        <Switch>
          <Route path="/" exact render={props => (
            <Site {...props} />
          )} />
          <Route path="/:projectId/:pageUrlName?" render={props => (
            <App {...props} />
          )} />
        </Switch>
      </Router>
    );
  }
}

export default Main;
