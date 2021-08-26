// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
/// <reference path="../@types/transform-media-imports.d.ts"/>
import loadable from '@loadable/component';
import { AppBar, Container, Drawer, Grid, Hidden, IconButton, Link as MuiLink, Toolbar } from '@material-ui/core';
import { createStyles, makeStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import CodeIcon from "@material-ui/icons/Code";
import CompareIcon from '@material-ui/icons/CompareArrows';
import CollectIcon from '@material-ui/icons/ContactSupportOutlined';
import DocsIcon from '@material-ui/icons/DescriptionRounded';
import ActIcon from '@material-ui/icons/DirectionsRun';
import RoadmapIcon from '@material-ui/icons/EqualizerRounded';
import FeedbackIcon from '@material-ui/icons/Feedback';
import MenuIcon from '@material-ui/icons/Menu';
import BlogIcon from '@material-ui/icons/MenuBookOutlined';
import AnalyzeIcon from '@material-ui/icons/ShowChart';
import DemoIcon from '@material-ui/icons/Slideshow';
import classNames from 'classnames';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import { Route, RouteComponentProps } from 'react-router';
import { Link, NavLink } from 'react-router-dom';
import * as Admin from '../api/admin';
import { Status } from '../api/server';
import ServerAdmin, { ReduxStateAdmin } from '../api/serverAdmin';
import { SSO_TOKEN_PARAM_NAME } from '../app/App';
import DemoOnboardingLogin from '../app/DemoOnboardingLogin';
import ErrorPage from '../app/ErrorPage';
import Loading from '../app/utils/Loading';
import OpenSourceIcon from '../common/icon/OpenSourceIcon';
import { MenuButton, MenuDropdown, MenuItems } from '../common/menus';
import MuiAnimatedSwitch from '../common/MuiAnimatedSwitch';
import { detectEnv, Environment } from '../common/util/detectEnv';
import { RedirectIso, RouteWithStatus } from '../common/util/routerUtil';
import { SetTitle } from '../common/util/titleUtil';
import windowIso from '../common/windowIso';
import { importFailed, importSuccess } from '../Main';
import { ClearFlaskEmbedHoverFeedback } from './ClearFlaskEmbed';
import { Project } from './DemoApp';
import Logo from './Logo';

const ContactPage = loadable(() => import(/* webpackChunkName: "ContactPage", webpackPrefetch: true */'./ContactPage').then(importSuccess).catch(importFailed), { fallback: (<Loading />) });
const LegalPage = loadable(() => import(/* webpackChunkName: "LegalPage" */'./LegalPage').then(importSuccess).catch(importFailed), { fallback: (<Loading />) });
const PricingPage = loadable(() => import(/* webpackChunkName: "PricingPage", webpackPrefetch: true */'./PricingPage').then(importSuccess).catch(importFailed), { fallback: (<Loading />) });

const Landing = loadable(() => import(/* webpackChunkName: "Landing" */'./LandingPages').then(importSuccess).catch(importFailed), { resolveComponent: cmpts => cmpts.Landing, fallback: (<Loading />) });
const LandingCollectFeedback = loadable(() => import(/* webpackChunkName: "LandingCollectFeedback" */'./LandingPages').then(importSuccess).catch(importFailed), { resolveComponent: cmpts => cmpts.LandingCollectFeedback, fallback: (<Loading />) });
const LandingContentCreator = loadable(() => import(/* webpackChunkName: "LandingContentCreator" */'./LandingPages').then(importSuccess).catch(importFailed), { resolveComponent: cmpts => cmpts.LandingContentCreator, fallback: (<Loading />) });
const LandingCrowdFunding = loadable(() => import(/* webpackChunkName: "LandingCrowdFunding" */'./LandingPages').then(importSuccess).catch(importFailed), { resolveComponent: cmpts => cmpts.LandingCrowdFunding, fallback: (<Loading />) });
const LandingCustomize = loadable(() => import(/* webpackChunkName: "LandingCustomize" */'./LandingPages').then(importSuccess).catch(importFailed), { resolveComponent: cmpts => cmpts.LandingCustomize, fallback: (<Loading />) });
const LandingEngagement = loadable(() => import(/* webpackChunkName: "LandingEngagement" */'./LandingPages').then(importSuccess).catch(importFailed), { resolveComponent: cmpts => cmpts.LandingEngagement, fallback: (<Loading />) });
const LandingFeatureRequestTracking = loadable(() => import(/* webpackChunkName: "LandingFeatureRequestTracking" */'./LandingPages').then(importSuccess).catch(importFailed), { resolveComponent: cmpts => cmpts.LandingFeatureRequestTracking, fallback: (<Loading />) });
const LandingGrowWithUs = loadable(() => import(/* webpackChunkName: "LandingGrowWithUs" */'./LandingPages').then(importSuccess).catch(importFailed), { resolveComponent: cmpts => cmpts.LandingGrowWithUs, fallback: (<Loading />) });
const LandingDemo = loadable(() => import(/* webpackChunkName: "LandingDemo" */'./LandingPages').then(importSuccess).catch(importFailed), { resolveComponent: cmpts => cmpts.LandingDemo, fallback: (<Loading />) });
const LandingIdeaManagement = loadable(() => import(/* webpackChunkName: "LandingIdeaManagement" */'./LandingPages').then(importSuccess).catch(importFailed), { resolveComponent: cmpts => cmpts.LandingIdeaManagement, fallback: (<Loading />) });
const LandingIntegrations = loadable(() => import(/* webpackChunkName: "LandingIntegrations" */'./LandingPages').then(importSuccess).catch(importFailed), { resolveComponent: cmpts => cmpts.LandingIntegrations, fallback: (<Loading />) });
const LandingInternalFeedback = loadable(() => import(/* webpackChunkName: "LandingInternalFeedback" */'./LandingPages').then(importSuccess).catch(importFailed), { resolveComponent: cmpts => cmpts.LandingInternalFeedback, fallback: (<Loading />) });
const LandingPrioritization = loadable(() => import(/* webpackChunkName: "LandingPrioritization" */'./LandingPages').then(importSuccess).catch(importFailed), { resolveComponent: cmpts => cmpts.LandingPrioritization, fallback: (<Loading />) });
const LandingPublicRoadmap = loadable(() => import(/* webpackChunkName: "LandingPublicRoadmap" */'./LandingPages').then(importSuccess).catch(importFailed), { resolveComponent: cmpts => cmpts.LandingPublicRoadmap, fallback: (<Loading />) });
const LandingCompare = loadable(() => import(/* webpackChunkName: "LandingCompare" */'./LandingPages').then(importSuccess).catch(importFailed), { resolveComponent: cmpts => cmpts.LandingCompare, fallback: (<Loading />) });
const LandingEmbedFeedbackPage = loadable(() => import(/* webpackChunkName: "LandingEmbedFeedbackPage" */'./LandingPages').then(importSuccess).catch(importFailed), { resolveComponent: cmpts => cmpts.LandingEmbedFeedbackPage, fallback: (<Loading />) });
const LandingOpenSource = loadable(() => import(/* webpackChunkName: "LandingOpenSource" */'./LandingPages').then(importSuccess).catch(importFailed), { resolveComponent: cmpts => cmpts.LandingOpenSource, fallback: (<Loading />) });

const styles = (theme: Theme) => createStyles({
  appBar: {
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
  },
  grow: {
    flexGrow: 1,
  },
  growAndFlex: {
    flexGrow: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  page: {
    minHeight: theme.vh(100),
  },
  appBarSpacer: theme.mixins.toolbar,
  bottomBar: {
    padding: theme.spacing(6),
    display: 'flex',
    justifyContent: 'center',
    borderTop: '1px solid ' + theme.palette.divider,
  },
  bottomItem: {
    display: 'block',
    padding: theme.spacing(0.5),
    color: theme.palette.text.secondary,
    textDecoration: 'none',
  },
  bottomLogo: {
    display: 'inline-flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomHeader: {
    padding: theme.spacing(0.5),
    paddingBottom: theme.spacing(1),
    color: theme.palette.text.secondary,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  bottomNavigationDivider: {
    minHeight: theme.spacing(1.5),
  },
  logoLink: {
    cursor: 'pointer',
    textDecoration: 'none',
    textTransform: 'unset',
  },
  menuItemsContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  roadmapIcon: {
    transform: 'rotate(180deg)',
  },
  menuItemsDrawer: {
    display: 'block',
    width: 240,
    paddingBottom: theme.spacing(2),
  },
});
const useStyles = makeStyles(styles);
interface ConnectProps {
  callOnMount?: () => void,
  accountStatus?: Status;
  account?: Admin.AccountAdmin;
}
interface State {
  menuOpen?: boolean;
}
class Site extends Component<ConnectProps & RouteComponentProps & WithStyles<typeof styles, true>, State> {
  state: State = {};
  projectPromise: undefined | Promise<Project>;

  constructor(props) {
    super(props);

    props.callOnMount?.();
  }

  render() {
    const isSingleCustomer = detectEnv() == Environment.PRODUCTION_SELF_HOST;
    if (isSingleCustomer) {
      return (
        <RedirectIso to='/login' />
      );
    }
    const menuItemsLeft: Array<MenuButton | MenuDropdown> = [
      {
        type: 'dropdown', title: 'Product', items: [
          { type: 'button', link: '/product/ask', title: 'Ask', icon: CollectIcon },
          { type: 'button', link: '/product/analyze', title: 'Analyze', icon: AnalyzeIcon },
          { type: 'button', link: '/product/act', title: 'Act', icon: ActIcon },
          { type: 'divider' },
          { type: 'button', link: '/product/demo', title: 'Demo', icon: DemoIcon },
          { type: 'divider' },
          { type: 'button', link: '/product/customize', title: 'Customize' },
          { type: 'button', link: '/product/scale-with-us', title: 'Scale with us' },
          { type: 'button', link: '/product/integrations', title: 'Integrations' },
          { type: 'divider' },
          { type: 'button', link: '/product/compare', title: 'Compare', icon: CompareIcon },
        ]
      },
      { type: 'button', link: '/pricing', title: 'Pricing' },
      // TODO Needs a complete SEO revamp
      // {
      //   type: 'dropdown', title: 'Solutions', items: [
      //     { type: 'button', link: '/solutions/feature-request-tracking', title: 'Feature Request Tracking', icon: RequestTrackingIcon },
      //     { type: 'button', link: '/solutions/product-roadmap', title: 'Product Roadmap', icon: RoadmapIcon, iconClassName: this.props.classes.roadmapIcon },
      //     // TODO Re-enable once Crowd-funding gets a revamp
      //     // import CrowdfundingIcon from '@material-ui/icons/MonetizationOn';
      //     // { type: 'button', link: '/solutions/feature-crowdfunding', title: 'Feature Crowdfunding', icon: CrowdfundingIcon },
      //     { type: 'divider' },
      //     { type: 'button', link: '/solutions/idea-management', title: 'Idea Management' },
      //     // TODO Re-enable once Crowd-funding gets a revamp
      //     // { type: 'button', link: '/solutions/content-creator-forum', title: 'Content Creator Forum' },
      //     { type: 'button', link: '/solutions/internal-feedback', title: 'Internal Feedback' },
      //   ]
      // },
      {
        type: 'dropdown', title: 'Resources', items: [
          { type: 'button', link: this.urlAddCfJwt(`${windowIso.location.protocol}//feedback.${windowIso.location.host}/docs`), linkIsExternal: true, title: 'Docs', icon: DocsIcon },
          { type: 'button', link: `${windowIso.location.protocol}//${windowIso.location.host}/api`, linkIsExternal: true, title: 'API', icon: CodeIcon },
          { type: 'divider' },
          { type: 'button', link: this.urlAddCfJwt(`${windowIso.location.protocol}//blog.${windowIso.location.host}`), linkIsExternal: true, title: 'Blog', icon: BlogIcon },
          { type: 'button', link: `/open-source`, title: 'Open source', icon: OpenSourceIcon },
          { type: 'button', link: '/e/roadmap', title: 'Roadmap', icon: RoadmapIcon, iconClassName: this.props.classes.roadmapIcon },
        ]
      },
    ];
    const menuItemsRight: Array<MenuButton> = [
      (!!this.props.account
        ? { type: 'button', link: '/dashboard', title: 'Dashboard' }
        : { type: 'button', link: '/login', title: 'Log in' }),
      { type: 'button', link: '/signup', title: 'Get started', primary: true, },
    ];
    const bottomNavigation: Array<MenuButton | MenuDropdown> = [
      ...menuItemsLeft,
      {
        type: 'dropdown', title: `© Smotana`, items: [
          { type: 'button', link: 'https://smotana.com', linkIsExternal: true, title: 'Smotana.com' },
          { type: 'button', link: '/contact', title: 'Contact' },
          { type: 'divider' },
          { type: 'button', link: '/signup', title: 'Sign up' },
          { type: 'button', link: '/dashboard', title: 'Dashboard' },
          { type: 'divider' },
          { type: 'button', link: '/privacy-policy', title: 'Privacy Policy' },
          { type: 'button', link: '/terms-of-service', title: 'Terms of Service' },
        ]
      }
    ];
    return (
      <div className={this.props.classes.growAndFlex}>
        <ClearFlaskEmbedHoverFeedback path='embed/feedback' Icon={FeedbackIcon} />
        <AppBar position='fixed' color='inherit' elevation={0} variant='elevation' className={this.props.classes.appBar}>
          <Container maxWidth='md' disableGutters>
            <Toolbar className={this.props.classes.toolbar}>
              <Hidden mdUp implementation='css'>
                <IconButton
                  aria-label='Menu'
                  onClick={() => this.setState({ menuOpen: true })}
                >
                  <MenuIcon />
                </IconButton>

                <Drawer
                  variant='temporary'
                  open={this.state.menuOpen}
                  onClose={() => this.setState({ menuOpen: false })}
                  ModalProps={{
                    keepMounted: true,
                  }}
                  classes={{ paper: this.props.classes.menuItemsDrawer }}
                >
                  <MenuItems
                    items={[
                      { type: 'header', title: 'ClearFlask' },
                      ...menuItemsRight,
                      ...menuItemsLeft]}
                    insideDrawer
                    onClick={() => this.setState({ menuOpen: false })}
                  />
                </Drawer>
              </Hidden>
              <Link to='/' className={this.props.classes.logoLink}>
                <Logo />
              </Link>
              <Hidden smDown implementation='css'>
                <div className={this.props.classes.menuItemsContainer}>
                  <MenuItems
                    items={menuItemsLeft}
                  />

                </div>
              </Hidden>
              <div className={this.props.classes.grow} />
              <Hidden smDown implementation='css'>
                <div className={this.props.classes.menuItemsContainer}>
                  <MenuItems
                    items={menuItemsRight}
                  />
                </div>
              </Hidden>
            </Toolbar>
          </Container>
        </AppBar>
        <div className={this.props.classes.appBarSpacer} />
        <div className={classNames(this.props.classes.growAndFlex, this.props.classes.page)}>
          <MuiAnimatedSwitch>
            <Route path='/contact'>
              <SetTitle title='Contact' />
              <ContactPage />
            </Route>
            <Route exact path='/sso'>
              <SetTitle title='Single sign-on' />
              <DemoOnboardingLogin type='sso' />
            </Route>
            <Route path='/oauth'>
              <SetTitle title='OAuth' />
              <DemoOnboardingLogin type='oauth' />
            </Route>
            <Route exact path='/terms-of-service'>
              <SetTitle title='Terms of Service' />
              <LegalPage type='terms' />
            </Route>
            <Route exact path='/(tos|terms)'>
              <RedirectIso to='/terms-of-service' />
            </Route>
            <Route exact path='/privacy-policy'>
              <SetTitle title='Terms of Service' />
              <LegalPage type='privacy' />
            </Route>
            <Route exact path='/(privacy|policy)'>
              <RedirectIso to='/privacy-policy' />
            </Route>

            <Route exact path='/'>
              <SetTitle />
              <Landing />
            </Route>

            <Route exact path='/product/ask'>
              <SetTitle title='Ask your users' />
              <LandingCollectFeedback />
            </Route>
            <Route exact path='/product/analyze'>
              <SetTitle title='Analyze feedback' />
              <LandingPrioritization />
            </Route>
            <Route exact path='/product/act'>
              <SetTitle title='Take action' />
              <LandingEngagement />
            </Route>
            <Route exact path='/product/customize'>
              <SetTitle title='Make it your own' />
              <LandingCustomize />
            </Route>
            <Route exact path='/product/integrations'>
              <SetTitle title='Integrations' />
              <LandingIntegrations />
            </Route>
            <Route exact path='/product/compare'>
              <SetTitle title='Customer Feedback Tools comparison' />
              <LandingCompare />
            </Route>
            <Route exact path='/product/scale-with-us'>
              <SetTitle title='Scale with us' />
              <LandingGrowWithUs />
            </Route>
            <Route exact path='/product/demo'>
              <SetTitle title='Demo' />
              <LandingDemo />
            </Route>

            <Route exact path='/solutions/feature-request-tracking'>
              <SetTitle title='Feature Request Tracking' />
              <LandingFeatureRequestTracking />
            </Route>
            <Route exact path='/solutions/product-roadmap'>
              <SetTitle title='Product Roadmap' />
              <LandingPublicRoadmap />
            </Route>
            <Route exact path='/solutions/feature-crowdfunding'>
              <SetTitle title='Feature Crowdfunding' />
              <LandingCrowdFunding />
            </Route>
            <Route exact path='/solutions/idea-management'>
              <SetTitle title='Idea Management' />
              <LandingIdeaManagement />
            </Route>
            <Route exact path='/solutions/content-creator-forum'>
              <SetTitle title='Content Creator Forum' />
              <LandingContentCreator />
            </Route>
            <Route exact path='/solutions/internal-feedback'>
              <SetTitle title='Internal Feedback' />
              <LandingInternalFeedback />
            </Route>

            <Route exact path='/open-source'>
              <SetTitle title='Open source' />
              <LandingOpenSource />
            </Route>
            <Route exact path='/pricing'>
              <SetTitle title='Pricing' />
              <PricingPage />
            </Route>

            <Route path='/e'>
              <LandingEmbedFeedbackPage />
            </Route>

            <RouteWithStatus httpCode={404} >
              <SetTitle title='Page not found' />
              <ErrorPage msg='Page not found' variant='error' />
            </RouteWithStatus>
          </MuiAnimatedSwitch>
        </div>
        <div className={this.props.classes.bottomBar}>
          <Container maxWidth='md' disableGutters>
            <Grid container justify='center' alignContent='center' spacing={6}>
              {bottomNavigation.map((item, index) => {
                if (item.type === 'dropdown') {
                  return (
                    <Grid key={index} item xs={6} sm={3} md={3} lg={2}>
                      <div key='header' className={this.props.classes.bottomHeader}>{item.title}</div>
                      {item.items.map((subItem, subIndex) => {
                        switch (subItem.type) {
                          case 'header':
                            return (
                              <div key={subIndex} className={this.props.classes.bottomHeader}>{subItem.title}</div>
                            );
                          case 'button':
                            if (subItem['linkIsExternal'] !== undefined) {
                              return (<MuiLink key={subIndex} href={subItem['link']} className={this.props.classes.bottomItem} underline='none'>{subItem.title}</MuiLink>);
                            } else if (subItem['link'] !== undefined) {
                              return (<NavLink key={subIndex} to={subItem['link']} className={this.props.classes.bottomItem}>{subItem.title}</NavLink>);
                            } else {
                              return (<MuiLink key={subIndex} onClick={subItem['onClick']} className={this.props.classes.bottomItem} underline='none'>{subItem.title}</MuiLink>);
                            }
                          case 'divider':
                            return (
                              <div className={this.props.classes.bottomNavigationDivider} />
                            );
                          default:
                            return null;
                        }
                      })}
                    </Grid>
                  );
                }
                return null;
              })}
            </Grid>
          </Container>
        </div>
      </div >
    );
  }

  urlAddCfJwt(url: string): string {
    return !!this.props.account
      ? `${url}?${SSO_TOKEN_PARAM_NAME}=${this.props.account.cfJwt}`
      : url;
  }
}

export default connect<ConnectProps, {}, {}, ReduxStateAdmin>((state, ownProps) => {
  const connectProps: ConnectProps = {
    accountStatus: state.account.account.status,
    account: state.account.account.account,
  };
  if (state.account.account.status === undefined) {
    connectProps.callOnMount = () => {
      ServerAdmin.get().dispatchAdmin()
        .then(d => d.accountBindAdmin({ accountBindAdmin: {} }));
    };
  }
  return connectProps;
}, null, null, { forwardRef: true })(withStyles(styles, { withTheme: true })(Site));
