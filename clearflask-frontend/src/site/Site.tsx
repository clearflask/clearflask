/// <reference path="../@types/transform-media-imports.d.ts"/>
import loadable from '@loadable/component';
import { AppBar, Button, Container, Divider, Drawer, Grid, Grow, Hidden, IconButton, Link as MuiLink, MenuItem, SvgIconTypeMap, Toolbar } from '@material-ui/core';
import { OverridableComponent } from '@material-ui/core/OverridableComponent';
import { createStyles, makeStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import GrowIcon from '@material-ui/icons/AccessibilityNew';
import InstallIcon from '@material-ui/icons/AccountTree';
import CustomizeIcon from '@material-ui/icons/Brush';
import CollectIcon from '@material-ui/icons/ContactSupportOutlined';
import ActIcon from '@material-ui/icons/DirectionsRun';
import RoadmapIcon from '@material-ui/icons/EqualizerRounded';
import InternalFeedbackIcon from '@material-ui/icons/Feedback';
import RequestTrackingIcon from '@material-ui/icons/Forum';
import ContentCreatorIcon from '@material-ui/icons/LiveTv';
import MenuIcon from '@material-ui/icons/Menu';
import CrowdfundingIcon from '@material-ui/icons/MonetizationOn';
import IdeasIcon from '@material-ui/icons/RecordVoiceOver';
import AnalyzeIcon from '@material-ui/icons/ShowChart';
import WidgetIcon from '@material-ui/icons/Widgets';
// import CareersIcon from '@material-ui/icons/Work';
import classNames from 'classnames';
import React, { Component } from 'react';
import { Route, RouteComponentProps } from 'react-router';
import { Link, NavLink } from 'react-router-dom';
import LogoImg from '../../public/img/clearflask-logo.png';
import DemoOnboardingLogin from '../app/DemoOnboardingLogin';
import ErrorPage from '../app/ErrorPage';
import Loading from '../app/utils/Loading';
import ClosablePopper from '../common/ClosablePopper';
import MuiAnimatedSwitch from '../common/MuiAnimatedSwitch';
import { RedirectIso, RouteWithStatus } from '../common/util/routerUtil';
import { vh } from '../common/util/screenUtil';
import { SCROLL_TO_STATE_KEY } from '../common/util/ScrollAnchor';
import { SetTitle } from '../common/util/titleUtil';
import windowIso from '../common/windowIso';
import { importFailed, importSuccess } from '../Main';
import { Project } from './DemoApp';

const SigninPage = loadable(() => import(/* webpackChunkName: "SigninPage", webpackPrefetch: true */'./SigninPage').then(importSuccess).catch(importFailed), { fallback: (<Loading />) });
const ContactPage = loadable(() => import(/* webpackChunkName: "ContactPage", webpackPrefetch: true */'./ContactPage').then(importSuccess).catch(importFailed), { fallback: (<Loading />) });
const LegalPage = loadable(() => import(/* webpackChunkName: "LegalPage" */'./LegalPage').then(importSuccess).catch(importFailed), { fallback: (<Loading />) });
const PricingPage = loadable(() => import(/* webpackChunkName: "PricingPage", webpackPrefetch: true */'./PricingPage').then(importSuccess).catch(importFailed), { fallback: (<Loading />) });
const TrialSignupPage = loadable(() => import(/* webpackChunkName: "TrialSignupPage", webpackPrefetch: true */'./TrialSignupPage').then(importSuccess).catch(importFailed), { fallback: (<Loading />) });

const Landing = loadable(() => import(/* webpackChunkName: "Landing" */'./LandingPages').then(importSuccess).catch(importFailed), { resolveComponent: cmpts => cmpts.Landing, fallback: (<Loading />) });
const LandingCollectFeedback = loadable(() => import(/* webpackChunkName: "LandingCollectFeedback" */'./LandingPages').then(importSuccess).catch(importFailed), { resolveComponent: cmpts => cmpts.LandingCollectFeedback, fallback: (<Loading />) });
const LandingContentCreator = loadable(() => import(/* webpackChunkName: "LandingContentCreator" */'./LandingPages').then(importSuccess).catch(importFailed), { resolveComponent: cmpts => cmpts.LandingContentCreator, fallback: (<Loading />) });
const LandingCrowdFunding = loadable(() => import(/* webpackChunkName: "LandingCrowdFunding" */'./LandingPages').then(importSuccess).catch(importFailed), { resolveComponent: cmpts => cmpts.LandingCrowdFunding, fallback: (<Loading />) });
const LandingCustomize = loadable(() => import(/* webpackChunkName: "LandingCustomize" */'./LandingPages').then(importSuccess).catch(importFailed), { resolveComponent: cmpts => cmpts.LandingCustomize, fallback: (<Loading />) });
const LandingEngagement = loadable(() => import(/* webpackChunkName: "LandingEngagement" */'./LandingPages').then(importSuccess).catch(importFailed), { resolveComponent: cmpts => cmpts.LandingEngagement, fallback: (<Loading />) });
const LandingFeatureRequestTracking = loadable(() => import(/* webpackChunkName: "LandingFeatureRequestTracking" */'./LandingPages').then(importSuccess).catch(importFailed), { resolveComponent: cmpts => cmpts.LandingFeatureRequestTracking, fallback: (<Loading />) });
const LandingInstall = loadable(() => import(/* webpackChunkName: "LandingInstall" */'./LandingPages').then(importSuccess).catch(importFailed), { resolveComponent: cmpts => cmpts.LandingInstall, fallback: (<Loading />) });
const LandingGrowWithUs = loadable(() => import(/* webpackChunkName: "LandingGrowWithUs" */'./LandingPages').then(importSuccess).catch(importFailed), { resolveComponent: cmpts => cmpts.LandingGrowWithUs, fallback: (<Loading />) });
const LandingIdeaManagement = loadable(() => import(/* webpackChunkName: "LandingIdeaManagement" */'./LandingPages').then(importSuccess).catch(importFailed), { resolveComponent: cmpts => cmpts.LandingIdeaManagement, fallback: (<Loading />) });
const LandingIntegrations = loadable(() => import(/* webpackChunkName: "LandingIntegrations" */'./LandingPages').then(importSuccess).catch(importFailed), { resolveComponent: cmpts => cmpts.LandingIntegrations, fallback: (<Loading />) });
const LandingInternalFeedback = loadable(() => import(/* webpackChunkName: "LandingInternalFeedback" */'./LandingPages').then(importSuccess).catch(importFailed), { resolveComponent: cmpts => cmpts.LandingInternalFeedback, fallback: (<Loading />) });
const LandingPrioritization = loadable(() => import(/* webpackChunkName: "LandingPrioritization" */'./LandingPages').then(importSuccess).catch(importFailed), { resolveComponent: cmpts => cmpts.LandingPrioritization, fallback: (<Loading />) });
const LandingPublicRoadmap = loadable(() => import(/* webpackChunkName: "LandingPublicRoadmap" */'./LandingPages').then(importSuccess).catch(importFailed), { resolveComponent: cmpts => cmpts.LandingPublicRoadmap, fallback: (<Loading />) });

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
    minHeight: vh(100),
    paddingBottom: theme.spacing(6),
  },
  appBarSpacer: theme.mixins.toolbar,
  bottomBar: {
    padding: theme.spacing(6),
    display: 'flex',
    justifyContent: 'center',
    borderTop: '1px solid ' + theme.palette.grey[300],
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
  logoButton: {
    display: 'flex',
    alignItems: 'center',
    margin: theme.spacing(0, 3),
    textTransform: 'unset',
    fontSize: '1.4em',
    cursor: 'pointer',
    textDecoration: 'none',
  },
  logo: {
    objectFit: 'contain',
    maxWidth: '48px',
    maxHeight: '48px',
    width: 'auto',
    height: 'auto',
    padding: theme.spacing(1),
  },
  menuItemsContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  roadmapIcon: {
    transform: 'rotate(180deg)',
  },
  button: {
    borderRadius: 10,
    display: 'flex',
    justifyContent: 'flex-start',
    padding: theme.spacing(0.5, 2),
    textTransform: 'unset',
  },
  buttonInsideDropdown: {
    margin: theme.spacing(2),
    padding: theme.spacing(0, 2),
  },
  buttonInsideDrawer: {
    height: 40,
    margin: theme.spacing(2),
    padding: theme.spacing(0, 2),
  },
  buttonOuter: {
    margin: theme.spacing(0, 1),
  },
  buttonIcon: {
    margin: theme.spacing(1, 3, 1, 0),
  },
  dropdownContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  menuPopper: {
    padding: theme.spacing(1),
    maxWidth: 300,
  },
  menuPopperPaper: {
    transform: 'translateX(-50%)',
    borderRadius: 10,
    marginTop: theme.spacing(1),
  },
  bottomNavigationDivider: {
    minHeight: theme.spacing(1.5),
  },
  menuItemsDrawer: {
    display: 'block',
    width: 240,
    paddingBottom: theme.spacing(2),
  },
  menuItemDividerInsideDrawer: {
    margin: theme.spacing(4),
  },
});
const useStyles = makeStyles(styles);

interface MenuDropdown {
  type: 'dropdown';
  title: string;
  items: Array<MenuButton | MenuHeader | MenuDivider>;
}
interface MenuButton {
  icon?: OverridableComponent<SvgIconTypeMap>,
  iconClassName?: string,
  type: 'button';
  title: string;
  link: string;
  linkIsExternal?: boolean;
  scrollState?: string;
}
interface MenuHeader {
  type: 'header';
  title: string;
}
interface MenuDivider {
  type: 'divider';
}

interface State {
  menuOpen?: boolean;
}

class Site extends Component<RouteComponentProps & WithStyles<typeof styles, true>, State> {
  state: State = {};
  projectPromise: undefined | Promise<Project>;

  render() {
    const menuItemsLeft: Array<MenuButton | MenuDropdown> = [
      {
        type: 'dropdown', title: 'Product', items: [
          { type: 'button', link: '/product/ask', title: 'Ask', icon: CollectIcon },
          { type: 'button', link: '/product/analyze', title: 'Analyze', icon: AnalyzeIcon },
          { type: 'button', link: '/product/act', title: 'Act', icon: ActIcon },
          { type: 'divider' },
          { type: 'button', link: '/product/customize', title: 'Customize', icon: CustomizeIcon },
          { type: 'button', link: '/product/install', title: 'Install', icon: InstallIcon },
          { type: 'button', link: '/product/scale-with-us', title: 'Scale with us', icon: GrowIcon },
          { type: 'button', link: '/product/integrations', title: 'Integrations', icon: WidgetIcon },
        ]
      },
      {
        type: 'dropdown', title: 'Solutions', items: [
          { type: 'button', link: '/solutions/feature-request-tracking', title: 'Feature Request Tracking', icon: RequestTrackingIcon },
          { type: 'button', link: '/solutions/product-roadmap', title: 'Product Roadmap', icon: RoadmapIcon, iconClassName: this.props.classes.roadmapIcon },
          { type: 'button', link: '/solutions/feature-crowdfunding', title: 'Feature Crowdfunding', icon: CrowdfundingIcon },
          { type: 'divider' },
          { type: 'button', link: '/solutions/idea-management', title: 'Idea Management', icon: IdeasIcon },
          { type: 'button', link: '/solutions/content-creator-forum', title: 'Content Creator Forum', icon: ContentCreatorIcon },
          { type: 'button', link: '/solutions/internal-feedback', title: 'Internal Feedback', icon: InternalFeedbackIcon },
        ]
      },
      {
        type: 'dropdown', title: 'Resources', items: [
          { type: 'button', link: `${windowIso.location.protocol}//blog.${windowIso.location.host}`, linkIsExternal: true, title: 'Blog' },
          { type: 'button', link: `${windowIso.location.protocol}//feedback.${windowIso.location.host}/docs`, linkIsExternal: true, title: 'Docs' },
          { type: 'button', link: `${windowIso.location.protocol}//${windowIso.location.host}/api`, linkIsExternal: true, title: 'API' },
          { type: 'divider' },
          { type: 'button', link: `${windowIso.location.protocol}//feedback.${windowIso.location.host}/roadmap`, linkIsExternal: true, title: 'Roadmap' },
          { type: 'button', link: `${windowIso.location.protocol}//feedback.${windowIso.location.host}/feedback`, linkIsExternal: true, title: 'Feedback' },
        ]
      },
    ];
    const menuItemsRight: Array<MenuButton> = [
      (this.props.location.pathname === '/' || this.props.location.pathname === '/signup')
        ? { type: 'button', link: '/login', title: 'Log in' }
        : { type: 'button', link: '/signup', title: 'Sign up' },
      { type: 'button', link: '/pricing', title: 'Pricing' },
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
              <Link
                className={this.props.classes.logoButton}
                to='/'
              >
                <img
                  alt=''
                  className={this.props.classes.logo}
                  src={LogoImg.src}
                  width={LogoImg.width}
                  height={LogoImg.height}
                />
                ClearFlask
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
        <div className={`${this.props.classes.growAndFlex} ${this.props.classes.page}`}>
          <MuiAnimatedSwitch>
            <Route exact path='/login'>
              <SetTitle title='Login' />
              <SigninPage />
            </Route>
            <Route path='/contact'>
              <SetTitle title='Contact' />
              <ContactPage />
            </Route>
            <Route exact path='/signup'>
              <SetTitle title='Sign up' />
              <TrialSignupPage />
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
            <Route exact path='/product/install'>
              <SetTitle title='Install' />
              <LandingInstall />
            </Route>
            <Route exact path='/product/scale-with-us'>
              <SetTitle title='Scale with us' />
              <LandingGrowWithUs />
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
            <Route exact path='/pricing'>
              <SetTitle title='Pricing' />
              <PricingPage />
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
                            return subItem.linkIsExternal ? (
                              <MuiLink key={subIndex} href={subItem.link} className={this.props.classes.bottomItem} underline='none'>{subItem.title}</MuiLink>
                            ) : (
                              <NavLink key={subIndex} to={subItem.link} className={this.props.classes.bottomItem}>{subItem.title}</NavLink>
                            );
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
      </div>
    );
  }
}

interface MenuDropdownButtonProps {
  dropdown: MenuDropdown;
  isOuter?: boolean;
}
interface MenuDropdownButtonState {
  open?: boolean;
  hover?: boolean;
}
class MenuDropdownButtonRaw extends React.Component<MenuDropdownButtonProps & WithStyles<typeof styles, true>, MenuDropdownButtonState> {
  state: MenuDropdownButtonState = {};
  lastEventId = 0;

  render() {
    const onMouseOverButton = () => {
      this.setState({ hover: true });
      const lastEventId = ++this.lastEventId;
      setTimeout(() => lastEventId === this.lastEventId
        && this.state.hover
        && this.setState({ open: true }), 1);
    };
    const onMouseOverPopper = () => {
      ++this.lastEventId; // Cancel any events including mouse out
    };
    const onMouseOut = () => {
      this.setState({ hover: false });
      const lastEventId = ++this.lastEventId;
      setTimeout(() => lastEventId === this.lastEventId
        && !this.state.hover
        && this.setState({ open: false }), 1);
    };
    return (
      <div className={this.props.classes.dropdownContainer}>
        <Button
          size='large'
          className={classNames(this.props.classes.button, this.props.isOuter && this.props.classes.buttonOuter)}
          onClick={() => {
            ++this.lastEventId;
            this.setState({ open: true })
          }}
          onMouseOver={onMouseOverButton}
          onMouseOut={onMouseOut}
        >
          {this.props.dropdown.title}
        </Button>
        <ClosablePopper
          paperClassName={this.props.classes.menuPopperPaper}
          className={this.props.classes.menuPopper}
          clickAway
          disableCloseButton
          open={!!this.state.open}
          onClose={() => {
            ++this.lastEventId;
            if (!this.state.open) this.setState({ open: false });
          }}
          onMouseOver={onMouseOverPopper}
          onMouseOut={onMouseOut}
          transitionCmpt={Grow}
          transitionProps={{
            style: { transformOrigin: '50% 0 0' },
            timeout: this.props.theme.transitions.duration.shortest,
          }}
          placement='bottom'
          modifiers={{
            preventOverflow: { enabled: false },
            flip: { enabled: false },
          }}
        >
          <MenuItems
            items={this.props.dropdown.items}
            onClick={() => {
              ++this.lastEventId;
              this.setState({ open: false })
            }}
            insideDropdown
          />
        </ClosablePopper>
      </div>
    );
  }
}
const MenuDropdownButton = withStyles(styles, { withTheme: true })(MenuDropdownButtonRaw);

function MenuItems(props: {
  items: Array<MenuButton | MenuHeader | MenuDivider | MenuDropdown>;
  onClick?: () => void;
  insideDrawer?: boolean;
  insideDropdown?: boolean;
}) {
  const isOuter = !props.insideDropdown && !props.insideDrawer;
  return (
    <React.Fragment>
      {props.items.map((item, index) => {
        switch (item.type) {
          case 'header':
            return (
              <MenuItemHeader
                insideDrawer={props.insideDrawer}
                item={item}
              />
            );
          case 'button':
            return (
              <MenuItemButton
                item={item}
                onClick={props.onClick}
                isOuter={isOuter}
                insideDropdown={props.insideDropdown}
                insideDrawer={props.insideDrawer}
              />
            );
          case 'divider':
            return (
              <MenuItemDivider
                insideDropdown={props.insideDropdown}
                insideDrawer={props.insideDrawer}
                item={item}
              />
            );
          case 'dropdown':
            if (props.insideDrawer) {
              return (
                <React.Fragment>
                  <MenuItemHeader
                    insideDrawer={props.insideDrawer}
                    item={{ type: 'header', title: item.title }}
                  />
                  <MenuItems
                    key={item.title}
                    items={item.items}
                    onClick={props.onClick}
                    insideDrawer={props.insideDrawer}
                    insideDropdown={props.insideDropdown}
                  />
                </React.Fragment>
              );
            } else {
              return (
                <MenuDropdownButton
                  key={item.title}
                  dropdown={item}
                  isOuter={isOuter}
                />
              );
            }
          default:
            return null;
        }
      })}
    </React.Fragment>
  );
};

function MenuItemButton(props: {
  item: MenuButton;
  onClick?: () => void;
  isOuter?: boolean;
  insideDropdown?: boolean;
  insideDrawer?: boolean;
}) {
  const classes = useStyles();
  const Icon = props.item.icon
  return (
    <Button
      size='large'
      key={props.item.title}
      className={classNames(
        classes.button,
        props.isOuter && classes.buttonOuter,
        props.insideDropdown && classes.buttonInsideDropdown,
        props.insideDrawer && classes.buttonInsideDrawer)}
      component={(props.item.linkIsExternal ? MuiLink : Link) as any}
      {...(props.item.linkIsExternal
        ? {
          href: props.item.link,
          underline: 'none',
        } : {
          to: {
            pathname: props.item.link,
            state: props.item.scrollState ? { [SCROLL_TO_STATE_KEY]: props.item.scrollState } : undefined,
          }
        })}
      onClick={props.onClick}
    >
      {Icon && (
        <Icon className={classNames(classes.buttonIcon, props.item.iconClassName)} />)}
      {props.item.title}
    </Button>
  );
};

function MenuItemHeader(props: {
  insideDrawer?: boolean;
  item: MenuHeader;
}) {
  return (
    <React.Fragment>
      <MenuItem
        key={props.item.title}
        disabled
        style={{
          justifyContent: props.insideDrawer ? 'flex-start' : 'center',
          minHeight: 48,
        }}
      >{props.item.title}</MenuItem>
      <Divider />
    </React.Fragment>
  );
};

function MenuItemDivider(props: {
  insideDrawer?: boolean;
  insideDropdown?: boolean;
  item: MenuDivider;
}) {
  const classes = useStyles();
  return props.insideDrawer ? (
    <div className={classes.menuItemDividerInsideDrawer} />
  ) : (
    <Divider />
  );
};

export default withStyles(styles, { withTheme: true })(Site);
