import { AppBar, Button, Container, Grid, Hidden, IconButton, Link as MuiLink, Menu, MenuItem, Toolbar } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import MenuIcon from '@material-ui/icons/Menu';
import React, { Component } from 'react';
import { Route, RouteComponentProps } from 'react-router';
import { Link, NavLink } from 'react-router-dom';
import ErrorPage from '../app/ErrorPage';
import SsoSuccessDemoPage from '../app/SsoSuccessDemoPage';
import DropdownButton from '../common/DropdownButton';
import MuiAnimatedSwitch from '../common/MuiAnimatedSwitch';
import { SCROLL_TO_STATE_KEY } from '../common/util/ScrollAnchor';
import { SetTitle } from '../common/util/titleUtil';
import { vh } from '../common/util/vhUtil';
import ContactPage from './ContactPage';
import { Project } from './DemoApp';
import LandingPage from './LandingPage';
import LegalPage from './LegalPage';
import PricingPage from './PricingPage';
import SigninPage from './SigninPage';
import TrialSignupPage from './TrialSignupPage';

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
  menuIndent: {
    marginLeft: theme.spacing(2),
  },
  menuButton: {
    textTransform: 'unset',
  },
  menuItemsContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
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
  scrollState?: string;
}

interface State {
  menuOpen?: boolean;
}

class Site extends Component<RouteComponentProps & WithStyles<typeof styles, true>, State> {
  state: State = {};
  projectPromise: undefined | Promise<Project>;
  readonly menuButtonRef: React.RefObject<HTMLButtonElement> = React.createRef();

  render() {
    const menuItemsLeft: Array<MenuButton | MenuDropdown> = [
      { type: 'button', path: '/', scrollState: 'collect', title: 'Collect' },
      { type: 'button', path: '/', scrollState: 'prioritize', title: 'Prioritize' },
      { type: 'button', path: '/', scrollState: 'engage', title: 'Engage' },
      { type: 'button', path: '/', scrollState: 'customize', title: 'Customize' },
    ];
    const menuItemsRight: Array<MenuButton | MenuDropdown> = [
      { type: 'button', path: '/contact/demo', title: 'Schedule a demo' },
      { type: 'button', path: '/pricing', title: 'Pricing' },
      { type: 'button', path: '/dashboard', title: 'Dashboard' },
    ];
    return (
      <div className={this.props.classes.growAndFlex}>
        <AppBar position='fixed' color='inherit' elevation={0} variant='elevation' className={this.props.classes.appBar}>
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
                    <MenuItem
                      key={menuItem.path}
                      component={Link as any}
                      to={{ pathname: menuItem.path, state: { [SCROLL_TO_STATE_KEY]: menuItem.scrollState } }}
                      onClick={() => this.setState({ menuOpen: false })}
                    >{menuItem.title}</MenuItem>
                  ) : [(
                    <MenuItem disabled key={menuItem.title}>{menuItem.title}</MenuItem>
                  ),
                  menuItem.items.map(subMenuItem => (
                    <MenuItem
                      key={subMenuItem.val}
                      className={this.props.classes.menuIndent}
                      component={Link as any}
                      to={subMenuItem.val}
                      onClick={() => this.setState({ menuOpen: false })}
                    >{subMenuItem.name}</MenuItem>
                  ))])}
                </Menu>
              </Hidden>
              <Link
                className={this.props.classes.logoButton}
                to='/'
              >
                <img
                  alt='logo'
                  className={this.props.classes.logo}
                  src='/img/clearflask-logo.png' />
                ClearFlask
              </Link>
              <Hidden xsDown implementation='css'>
                <div className={this.props.classes.menuItemsContainer}>
                  {menuItemsLeft.map(menuItem => menuItem.type === 'button' ? (
                    <Button
                      key={menuItem.path}
                      className={this.props.classes.menuButton}
                      component={Link}
                      to={{ pathname: menuItem.path, state: { [SCROLL_TO_STATE_KEY]: menuItem.scrollState } }}
                    >{menuItem.title}</Button>
                  ) : (
                      <DropdownButton
                        key={menuItem.title}
                        buttonClassName={this.props.classes.menuButton}
                        label={menuItem.title}
                        links={menuItem.items}
                      />
                    ))}
                </div>
              </Hidden>
              <div className={this.props.classes.grow} />
              <Hidden xsDown implementation='css'>
                <div className={this.props.classes.menuItemsContainer}>
                  {menuItemsRight.map(menuItem => menuItem.type === 'button' ? (
                    <Button
                      key={menuItem.path}
                      className={this.props.classes.menuButton}
                      component={Link}
                      to={{ pathname: menuItem.path, state: { [SCROLL_TO_STATE_KEY]: menuItem.scrollState } }}
                    >{menuItem.title}</Button>
                  ) : (
                      <DropdownButton
                        key={menuItem.title}
                        buttonClassName={this.props.classes.menuButton}
                        label={menuItem.title}
                        links={menuItem.items}
                      />
                    ))}
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
            <Route exact path='/pricing'>
              <SetTitle title='Pricing' />
              <PricingPage />
            </Route>
            <Route exact path='/signup'>
              <SetTitle title='Sign up' />
              <TrialSignupPage />
            </Route>
            <Route exact path='/sso'>
              <SetTitle title='Single sign-on' />
              <SsoSuccessDemoPage />
            </Route>
            <Route exact path='/(tos|terms|terms-of-service)'>
              <SetTitle title='Terms of Service' />
              <LegalPage type='terms' />
            </Route>
            <Route exact path='/(privacy|policy|privacy-policy)'>
              <SetTitle title='Terms of Service' />
              <LegalPage type='privacy' />
            </Route>
            <Route exact path='/'>
              <SetTitle />
              <LandingPage />
            </Route>
            <Route>
              <SetTitle title='Page not found' />
              <ErrorPage msg='Page not found' variant='error' />
            </Route>
          </MuiAnimatedSwitch>
        </div>
        <div className={this.props.classes.bottomBar}>
          <Container maxWidth='md' disableGutters>
            <Grid container justify='center' alignContent='center' spacing={6}>
              {/* <Grid item xs={10} sm={4} md={3} xl={2}>
                <div className={this.props.classes.bottomHeader}>PRODUCT</div>
                <NavLink to='/contact/sales' className={this.props.classes.bottomItem}>Talk to Sales</NavLink>
                <NavLink to='/pricing' className={this.props.classes.bottomItem}>Pricing</NavLink>
                <NavLink to='/demo' className={this.props.classes.bottomItem}>Demo</NavLink>
                <NavLink to='/signup' className={this.props.classes.bottomItem}>Sign up</NavLink>
              </Grid> */}
              <Grid item xs={10} sm={4} md={3} xl={2}>
                <div className={this.props.classes.bottomHeader}>RESOURCES</div>
                <NavLink to='/contact/support' className={this.props.classes.bottomItem}>Support</NavLink>
                <NavLink to='/privacy-policy' className={this.props.classes.bottomItem}>Privacy Policy</NavLink>
                <NavLink to='/terms-of-service' className={this.props.classes.bottomItem}>Terms of Service</NavLink>
              </Grid>
              <Grid item xs={10} sm={4} md={3} xl={2} className={this.props.classes.growAndFlex}>
                <div className={this.props.classes.bottomHeader}>COMPANY</div>
                <MuiLink target="_blank" href='https://www.smotana.com' className={this.props.classes.bottomItem}>Smotana</MuiLink>
                <MuiLink href='mailto:hi@clearflask.com' className={this.props.classes.bottomItem}>hi@clearflask.com</MuiLink>
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

export default withStyles(styles, { withTheme: true })(Site);
