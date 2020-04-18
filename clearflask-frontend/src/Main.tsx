import { createMuiTheme, Theme } from '@material-ui/core';
import CssBaseline from '@material-ui/core/CssBaseline';
import { MuiThemeProvider } from '@material-ui/core/styles';
import React, { Component, Suspense } from 'react';
import ReactGA from 'react-ga';
import { Provider } from 'react-redux';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
import ServerAdmin from './api/serverAdmin';
import CaptchaChallenger from './app/utils/CaptchaChallenger';
import EnvironmentNotifier from './app/utils/EnvironmentNotifier';
import Loading from './app/utils/Loading';
import MuiSnackbarProvider from './app/utils/MuiSnackbarProvider';
import ServerErrorNotifier from './app/utils/ServerErrorNotifier';
import { closeLoadingScreen } from './common/loadingScreen';
import { detectEnv, Environment, isTracking } from './common/util/detectEnv';
import setTitle from './common/util/titleUtil';
import ScrollToTop from './ScrollToTop';

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

  constructor(props) {
    super(props);

    if (isTracking()) {
      ReactGA.initialize('UA-127162051-3', {
        gaOptions: {}
      });
      ReactGA.set({
        anonymizeIp: true,
        forceSSL: true
      });
      ReactGA.pageview(window.location.pathname + window.location.search);
    }

    setTitle();
  }

  render() {
    const subdomain = this.getSubdomain();
    if (subdomain === 'www') {
      // Redirect www to homepage
      window.location.replace(window.location.origin.replace(`${subdomain}\.`, ''));
    }
    const App = React.lazy(() => import('./app/App'/* webpackChunkName: "app" */).then(i => (closeLoadingScreen(), i)));
    const Dashboard = React.lazy(() => import('./site/Dashboard'/* webpackChunkName: "dashboard" */).then(i => (closeLoadingScreen(), i)));
    const Site = React.lazy(() => import('./site/Site'/* webpackChunkName: "site" */).then(i => (closeLoadingScreen(), i)));
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
              {isTracking() && (
                <Route path="/" render={({ location }) => {
                  ReactGA.set({ page: location.pathname + location.search });
                  ReactGA.pageview(location.pathname + location.search);
                  return null;
                }} />
              )}
              <Suspense fallback={<Loading />}>
                <Switch>
                  {subdomain ? (
                    <Route path="/" render={props => (
                      <App projectId={subdomain} {...props} />
                    )} />
                  ) : ([(
                    <Route key='dashboard' path="/dashboard/:path?/:subPath*" render={props => (
                      <Provider store={ServerAdmin.get().getStore()}>
                        <Dashboard {...props} />
                      </Provider>
                    )} />
                  ), (
                    <Route key='site' render={props => (
                      <Provider store={ServerAdmin.get().getStore()}>
                        <Site {...props} />
                      </Provider>
                    )} />
                  )])}
                </Switch>
              </Suspense>
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
        if (hostSplit.length === 2 && hostSplit[1] === 'localhost') {
          subdomain = hostSplit[0];
        } else if (hostSplit.length === 3) {
          subdomain = hostSplit[0];
        }
        break;
    }
    return subdomain;
  }
}

export default Main;
