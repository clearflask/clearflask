import loadable from '@loadable/component';
import { createMuiTheme, NoSsr, Theme } from '@material-ui/core';
import CssBaseline from '@material-ui/core/CssBaseline';
import { MuiThemeProvider, StylesProvider } from '@material-ui/core/styles';
import { ProviderContext } from 'notistack';
import React, { Component } from 'react';
import ReactGA from 'react-ga';
import { Provider } from 'react-redux';
import { StaticRouterContext } from 'react-router';
import { BrowserRouter, Route, StaticRouter, Switch } from 'react-router-dom';
import ServerAdmin from './api/serverAdmin';
import { ComponentPropsOverrides } from './app/AppThemeProvider';
import CaptchaChallenger from './app/utils/CaptchaChallenger';
import EnvironmentNotifier from './app/utils/EnvironmentNotifier';
import Loading from './app/utils/Loading';
import MuiSnackbarProvider from './app/utils/MuiSnackbarProvider';
import ServerErrorNotifier from './app/utils/ServerErrorNotifier';
import { closeLoadingScreen } from './common/loadingScreen';
import { detectEnv, Environment, isTracking } from './common/util/detectEnv';
import { redirectIso } from './common/util/routerUtil';
import { vh } from './common/util/screenUtil';
import ScrollAnchor from './common/util/ScrollAnchor';
import windowIso from './common/windowIso';
import HotjarWrapperMain from './site/HotjarWrapperMain';
import IntercomWrapperMain from './site/IntercomWrapperMain';

const notistackRef = React.createRef<ProviderContext>();
export const importSuccess = i => {
  closeLoadingScreen();
  return i;
};
export const importFailed = e => {
  notistackRef.current?.enqueueSnackbar("Network connectivity issues, please reload the page", {
    variant: 'error',
    preventDuplicate: true,
    persist: true,
  });
};
const App = loadable(() => import(/* webpackChunkName: "app", webpackPrefetch: true */'./app/App').then(importSuccess).catch(importFailed), { fallback: (<Loading />) });
const Dashboard = loadable(() => import(/* webpackChunkName: "dashboard" */'./site/Dashboard').then(importSuccess).catch(importFailed), { fallback: (<Loading />) });
const Site = loadable(() => import(/* webpackChunkName: "site" */'./site/Site').then(importSuccess).catch(importFailed), { fallback: (<Loading />) });
const Invoice = loadable(() => import(/* webpackChunkName: "invoice" */'./site/InvoicePage').then(importSuccess).catch(importFailed), { fallback: (<Loading />) });
const PostStatus = loadable(() => import(/* webpackChunkName: "postStatus" */'./app/PostStatus').then(importSuccess).catch(importFailed), { fallback: (<Loading />) });

const theme: Theme = createMuiTheme({
  palette: {
    // type: 'dark',
    background: {
      default: '#fff',
      paper: '#fff',
    },
    primary: {
      main: '#218774',
    },
  },
  overrides: {
    MuiAppBar: {
      colorDefault: {
        backgroundColor: '#fff',
      },
    },
  },
  props: {
    ...ComponentPropsOverrides,
  },
});
interface Props {
  ssrLocation?: string;
  ssrStaticRouterContext?: StaticRouterContext;
}
class Main extends Component<Props> {
  customerTrackerPresent: boolean = false;

  constructor(props) {
    super(props);

    if (isTracking() && !windowIso.isSsr) {
      try {
        ReactGA.initialize('UA-127162051-3', {
          gaOptions: {}
        });
        ReactGA.set({
          anonymizeIp: true,
          forceSSL: true
        });
        ReactGA.pageview(windowIso.location.pathname + windowIso.location.search);
      } catch (e) { }
    }
  }

  render() {
    const Router = (windowIso.isSsr ? StaticRouter : BrowserRouter) as React.ElementType;
    if (windowIso.location.hostname === 'www.clearflask.com') {
      // Redirect www to homepage
      redirectIso(windowIso.location.origin.replace(`www.`, ''));
      return null;
    }
    const isProject = this.isProject();
    return (
      <React.StrictMode>
        <StylesProvider injectFirst>
          <MuiThemeProvider theme={theme}>
            <MuiSnackbarProvider notistackRef={notistackRef}>
              <CssBaseline />
              <ServerErrorNotifier />
              <CaptchaChallenger />
              <RemoveSsrCss />
              <div style={{
                minHeight: vh(100),
                display: 'flex',
                flexDirection: 'column',
                background: theme.palette.background.default,
              }}>
                <Router
                  {...(windowIso.isSsr ? {
                    location: this.props.ssrLocation,
                    context: this.props.ssrStaticRouterContext,
                  } : {})}
                >
                  <ScrollAnchor scrollOnNavigate />
                  {isTracking() && (
                    <Route path='/' render={({ location }) => {
                      ReactGA.set({ page: location.pathname + location.search });
                      ReactGA.pageview(location.pathname + location.search);
                      return null;
                    }} />
                  )}
                  <Route render={({ location }) => location.pathname.startsWith('/embed-status') ? null : (
                    <EnvironmentNotifier key='env-notifier' />
                  )} />
                  <Switch>
                    {isProject ? ([(
                      <Route key='embed-status' path="/embed-status/post/:postId" render={props => (
                        <React.Fragment>
                          <SetMaxAge val={24 * 60 * 60} />
                          <PostStatus
                            {...props}
                            postId={props.match.params['postId'] || ''}
                          />
                        </React.Fragment>
                      )} />
                    ), (
                      <Route key='app' path="/" render={props => (
                        <App slug={windowIso.location.hostname} {...props} />
                      )} />
                    )]) : ([(
                      <Route key='dashboard' path="/dashboard/:path?/:subPath*" render={props => (
                        <Provider store={ServerAdmin.get().getStore()}>
                          <SetMaxAge val={0 /* If you want to cache, don't cache if auth is present in URL */} />
                          <NoSsr>
                            <Dashboard {...props} />
                          </NoSsr>
                          <IntercomWrapperMain />
                          <HotjarWrapperMain />
                        </Provider>
                      )} />
                    ), (
                      <Route key='invoice' path="/invoice/:invoiceId" render={props => (
                        <Provider store={ServerAdmin.get().getStore()}>
                          <SetMaxAge val={0} />
                          <Invoice invoiceId={props.match.params['invoiceId']} />
                        </Provider>
                      )} />
                    ), (
                      <Route key='site' render={props => (
                        <Provider store={ServerAdmin.get().getStore()}>
                          <SetMaxAge val={24 * 60 * 60} />
                          <Site {...props} />
                          <IntercomWrapperMain />
                          <HotjarWrapperMain />
                        </Provider>
                      )} />
                    )])}
                  </Switch>
                </Router>
              </div>
            </MuiSnackbarProvider>
          </MuiThemeProvider>
        </StylesProvider>
      </React.StrictMode>
    );
  }

  isProject(): boolean {
    switch (detectEnv()) {
      case Environment.PRODUCTION:
        return windowIso.location.hostname !== 'clearflask.com';
      default:
      case Environment.DEVELOPMENT_FRONTEND:
      case Environment.DEVELOPMENT_LOCAL:
        return windowIso.location.hostname !== 'localhost'
          && windowIso.location.hostname !== 'localhost.com';
    }
  }
}

const RemoveSsrCss = () => {
  React.useEffect(() => {
    // useEffect is called after screen is committed, as oppose to componentDidMount
    // The CSR CSS should already be present and SSR CSS can be safely removed
    const ssrJssEl = document.getElementById('ssr-jss');
    ssrJssEl?.parentNode?.removeChild(ssrJssEl);
  }, []);
  return null;
};

const SetMaxAge = (props: { val: number }) => {
  windowIso.isSsr && windowIso.setMaxAge(props.val);
  return null;
};

export default Main;
