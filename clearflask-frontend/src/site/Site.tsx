import { AppBar, Button, Container, Grid, Hidden, IconButton, Link, Menu, MenuItem, Toolbar } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import MenuIcon from '@material-ui/icons/Menu';
import React, { Component } from 'react';
import { Route, RouteComponentProps } from 'react-router';
import { NavLink } from 'react-router-dom';
import ErrorPage from '../app/ErrorPage';
import DropdownButton from '../common/DropdownButton';
import MuiAnimatedSwitch from '../common/MuiAnimatedSwitch';
import Promised from '../common/Promised';
import setTitle from '../common/util/titleUtil';
import { vh } from '../common/util/vhUtil';
import CaseStudyPage from './CaseStudyPage';
import CollectPage from './CollectPage';
import ContactPage from './ContactPage';
import CustomizePage from './CustomizePage';
import DemoApp, { getProject, Project } from './DemoApp';
import EngagePage from './EngagePage';
import LandingPage from './LandingPage';
import LegalPage from './LegalPage';
import PricingPage from './PricingPage';
import PrioritizePage from './PrioritizePage';
import ProductPage from './ProductPage';
import SigninPage from './SigninPage';
import TrialSignupPage from './TrialSignupPage';
const styles = (theme: Theme) => createStyles({
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
    PaddingBottom: theme.spacing(6),
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
  },
  logoButton: {
    display: 'flex',
    alignItems: 'center',
    margin: theme.spacing(0, 3),
    textTransform: 'unset',
    fontSize: '1.4em',
    cursor: 'pointer',
  },
  logo: {
    maxWidth: '48px',
    maxHeight: '48px',
  },
  menuIndent: {
    marginLeft: theme.spacing(2),
  },
  menuButton: {
    textTransform: 'unset',
  }
});

interface MenuDropdown {
  type: 'dropdown';
  title: string;
  items: Array<{ name: string; val: string }>;
}
interface MenuButton {
  type: 'button';
  title: string;
  path: string;
}

interface State {
  menuOpen?: boolean;
}

class Site extends Component<RouteComponentProps & WithStyles<typeof styles, true>, State> {
  state: State = {};
  projectPromise: undefined | Promise<Project>;
  readonly menuButtonRef: React.RefObject<HTMLButtonElement> = React.createRef();

  render() {
    const menuItemsLeft: Array<MenuButton | MenuDropdown> = [];
    const menuItemsRight: Array<MenuButton | MenuDropdown> = [
      { type: 'button', path: '/contact/demo', title: 'Schedule a demo' },
      { type: 'button', path: '/dashboard', title: 'Log in' },
    ];
    return (
      <div className={this.props.classes.growAndFlex}>
        {/* <HideOnScroll> */}
        <AppBar position='absolute' color='inherit' elevation={0} variant='elevation'>
          <Container maxWidth='md' disableGutters>
            <Toolbar className={this.props.classes.toolbar}>
              <Hidden smUp implementation='css'>
                <IconButton
                  ref={this.menuButtonRef}
                  aria-label='Menu'
                  onClick={() => this.setState({ menuOpen: true })}
                >
                  <MenuIcon />
                </IconButton>
                <Menu
                  anchorEl={this.menuButtonRef.current}
                  keepMounted
                  open={!!this.state.menuOpen}
                  onClose={() => this.setState({ menuOpen: false })}
                >
                  {[...menuItemsLeft, ...menuItemsRight].map((menuItem, index) => menuItem.type === 'button' ? (
                    <MenuItem key={menuItem.path} onClick={() => {
                      this.setState({ menuOpen: false });
                      this.props.history.push(menuItem.path);
                    }}>{menuItem.title}</MenuItem>
                  ) : [(
                    <MenuItem disabled key={menuItem.title}>{menuItem.title}</MenuItem>
                  ),
                  menuItem.items.map(subMenuItem => (
                    <MenuItem key={subMenuItem.val} className={this.props.classes.menuIndent} onClick={() => {
                      this.setState({ menuOpen: false });
                      this.props.history.push(subMenuItem.val);
                    }}>{subMenuItem.name}</MenuItem>
                  ))])}
                </Menu>
              </Hidden>
              <div
                className={this.props.classes.logoButton}
                onClick={() => this.props.history.push('/')}
              >
                <img
                  alt='logo'
                  className={this.props.classes.logo}
                  src='/img/clearflask-logo.png' />
                ClearFlask
              </div>
              <Hidden xsDown implementation='css'>
                {menuItemsLeft.map(menuItem => menuItem.type === 'button' ? (
                  <Button key={menuItem.path} className={this.props.classes.menuButton} onClick={() => this.props.history.push(menuItem.path)}>{menuItem.title}</Button>
                ) : (
                    <DropdownButton
                      key={menuItem.title}
                      buttonClassName={this.props.classes.menuButton}
                      label={menuItem.title}
                      links={menuItem.items}
                      // TODO value={}
                      onChange={val => this.props.history.push(val)}
                    />
                  ))}
              </Hidden>
              <div className={this.props.classes.grow} />
              <Hidden xsDown implementation='css'>
                {menuItemsRight.map(menuItem => menuItem.type === 'button' ? (
                  <Button key={menuItem.path} className={this.props.classes.menuButton} onClick={() => this.props.history.push(menuItem.path)}>{menuItem.title}</Button>
                ) : (
                    <DropdownButton
                      key={menuItem.title}
                      buttonClassName={this.props.classes.menuButton}
                      label={menuItem.title}
                      links={menuItem.items}
                      // TODO value={}
                      onChange={val => this.props.history.push(val)}
                    />
                  ))}
              </Hidden>
            </Toolbar>
          </Container>
        </AppBar>
        {/* </HideOnScroll> */}
        <div className={`${this.props.classes.growAndFlex} ${this.props.classes.page}`}>
          <div className={this.props.classes.appBarSpacer} />
          <MuiAnimatedSwitch>
            <Route exact path={'/login'} render={props => {
              setTitle('Login');
              return (<SigninPage {...props} />);
            }} />
            <Route exact path={'/pricing'} render={props => {
              setTitle('Pricing');
              return (<PricingPage {...props} />);
            }} />
            <Route path={'/contact'} render={props => {
              setTitle('Contact');
              return (<ContactPage {...props} />);
            }} />
            <Route exact path={'/signup'} render={props => {
              setTitle('Sign up');
              return (<TrialSignupPage {...props} />);
            }} />
            <Route exact path={'/(terms|terms-of-service)'} render={props => {
              setTitle('Terms of Service');
              return (<LegalPage type='terms' />);
            }} />
            <Route exact path={'/(privacy|policy|privacy-policy)'} render={props => {
              setTitle('Privacy Policy');
              return (<LegalPage type='privacy' />);
            }} />
            <Route path={`/:projectId(demo)`} render={props => {
              setTitle('Demo');
              if (!this.projectPromise) this.projectPromise = getProject(
                templater => templater.demo(),
                mocker => mocker.mockAll(),
                'demo',
              );
              return (
                <Promised promise={this.projectPromise} render={project => (
                  <DemoApp
                    {...props}
                    server={project.server}
                  />
                )} />
              );
            }} />
            <Route exact path={`/collect`} component={props => {
              setTitle('Collect');
              return (<CollectPage />);
            }} />
            <Route exact path={`/prioritize`} component={props => {
              setTitle('Prioritize');
              return (<PrioritizePage />);
            }} />
            <Route exact path={`/engage`} component={props => {
              setTitle('Engage');
              return (<EngagePage />);
            }} />
            <Route exact path={`/customize`} component={props => {
              setTitle('Customize');
              return (<CustomizePage />);
            }} />
            <Route exact path={`/case-study`} component={props => {
              setTitle('Case Studies');
              return (<CaseStudyPage />);
            }} />
            <Route exact path={`/product`} component={props => {
              setTitle('Product');
              return (<ProductPage />);
            }} />
            <Route exact path={`/`} component={props => {
              setTitle();
              return (<LandingPage />);
            }} />
            <Route component={props => {
              setTitle("Page not found");
              return (<ErrorPage msg='Page not found' variant='error' />);
            }} />
          </MuiAnimatedSwitch>
        </div>
        <div className={this.props.classes.bottomBar}>
          <Container maxWidth='md' disableGutters>
            <Grid container justify='center' alignContent='center' spacing={6}>
              <Grid item xs={10} sm={4} md={3} xl={2}>
                <div className={this.props.classes.bottomHeader}>PRODUCT</div>
                <NavLink to='/contact/sales' className={this.props.classes.bottomItem}>Talk to Sales</NavLink>
                <NavLink to='/pricing' className={this.props.classes.bottomItem}>Pricing</NavLink>
                <NavLink to='/demo' className={this.props.classes.bottomItem}>Demo</NavLink>
                {/* <NavLink to='/signup' className={this.props.classes.bottomItem}>Sign up</NavLink> */}
              </Grid>
              <Grid item xs={10} sm={4} md={3} xl={2}>
                <div className={this.props.classes.bottomHeader}>RESOURCES</div>
                <NavLink to='/contact/support' className={this.props.classes.bottomItem}>Support</NavLink>
                <NavLink to='/privacy-policy' className={this.props.classes.bottomItem}>Privacy Policy</NavLink>
                <NavLink to='/terms-of-service' className={this.props.classes.bottomItem}>Terms of Service</NavLink>
              </Grid>
              <Grid item xs={10} sm={4} md={3} xl={2} className={this.props.classes.growAndFlex}>
                <div className={this.props.classes.bottomHeader}>COMPANY</div>
                <Link target="_blank" href='https://www.smotana.com' className={this.props.classes.bottomItem}>Smotana</Link>
                <Link href='mailto:hi@smotana.com' className={this.props.classes.bottomItem}>hi@smotana.com</Link>
                <div className={this.props.classes.grow} />
                <div className={this.props.classes.bottomItem}>© ClearFlask</div>
              </Grid>
            </Grid>
          </Container>
        </div>
      </div>
    );
  }
}

// function HideOnScroll(props) {
//   const trigger = useScrollTrigger();
//   return (
//     <Slide appear={false} direction="down" in={!trigger}>
//       {props.children}
//     </Slide>
//   );
// }

export default withStyles(styles, { withTheme: true })(Site);
