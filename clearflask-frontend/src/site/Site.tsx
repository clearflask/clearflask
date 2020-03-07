import { AppBar, Button, Container, Hidden, IconButton, Menu, MenuItem, Toolbar, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import MenuIcon from '@material-ui/icons/Menu';
import React, { Component } from 'react';
import { Route, RouteComponentProps } from 'react-router';
import App from '../app/App';
import MuiAnimatedSwitch from '../common/MuiAnimatedSwitch';
import Promised from '../common/Promised';
import ContactPage from './ContactPage';
import { getProject, Project } from './DemoApp';
import LandingPage from './LandingPage';
import LegalPage from './LegalPage';
import PricingPage from './PricingPage';
import SigninPage from './SigninPage';
import SignupPage from './SignupPage';

const styles = (theme: Theme) => createStyles({
  toolbar: {
    display: 'flex',
  },
  grow: {
    flexGrow: 1,
  },
  growAndFlex: {
    flexGrow: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  appBarSpacer: theme.mixins.toolbar,
  appbar: {
    borderBottom: '1px solid ' + theme.palette.grey[300],
  },
  logo: {
    margin: theme.spacing(1),
    maxWidth: '48px',
    maxHeight: '48px',
  },
});

interface State {
  menuOpen?: boolean;
}

class Site extends Component<RouteComponentProps & WithStyles<typeof styles, true>, State> {
  state: State = {};
  projectPromise: undefined | Promise<Project>;
  readonly menuButtonRef: React.RefObject<HTMLButtonElement> = React.createRef();

  render() {
    const menuItems = [
      { path: '/demo', title: 'Demo' },
      { path: '/pricing', title: 'Pricing' },
      { path: '/contact', title: 'Contact' },
      { path: '/dashboard', title: 'Dashboard' },
    ]
    return (
      <div className={this.props.classes.growAndFlex}>
        {/* <HideOnScroll> */}
        <AppBar position='relative' color='inherit' elevation={0} className={this.props.classes.appbar}>
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
                  {menuItems.map((menuItem, index) =>
                    <MenuItem key={menuItem.path} onClick={() => {
                      this.setState({ menuOpen: false });
                      this.props.history.push(menuItem.path);
                    }}>{menuItem.title}</MenuItem>
                  )}
                </Menu>
              </Hidden>
              <img
                alt='logo'
                className={this.props.classes.logo}
                src='/clearflask-logo.png' />
              <Button
                style={{ textTransform: 'unset' }}
                onClick={() => this.props.history.push('/')}
              >
                <Typography variant="h6">Clear Flask</Typography>
              </Button>
              <div className={this.props.classes.grow} />
              <Hidden xsDown implementation='css'>
                {menuItems.map(menuItem =>
                  <Button onClick={() => this.props.history.push(menuItem.path)}>{menuItem.title}</Button>
                )}
              </Hidden>
            </Toolbar>
          </Container>
        </AppBar>
        {/* </HideOnScroll> */}
        <div className={this.props.classes.appBarSpacer} />
        <MuiAnimatedSwitch>
          <Route exact path={'/login'} render={props => (
            <SigninPage {...props} />
          )} />
          <Route exact path={'/pricing'} render={props => (
            <PricingPage {...props} />
          )} />
          <Route path={'/contact'} render={props => (
            <ContactPage {...props} />
          )} />
          <Route exact path={'/signup'} render={props => (
            <SignupPage {...props} />
          )} />
          <Route exact path={'/(terms|terms-of-service)'} render={props => (
            <LegalPage type='terms' />
          )} />
          <Route exact path={'/(privacy|policy|privacy-policy)'} render={props => (
            <LegalPage type='privacy' />
          )} />
          <Route path={`/:projectId(demo)`} render={props => {
            if (!this.projectPromise) this.projectPromise = getProject(
              templater => templater.demo(),
              mocker => mocker.mockAll(),
              'demo',
            );
            return (
              <Promised promise={this.projectPromise} render={project => (
                <App
                  {...props}
                  supressCssBaseline
                  isInsideContainer
                  serverOverride={project.server}
                />
              )} />
            );
          }} />
          <Route exact path={`/`} component={props => (
            <LandingPage />
          )} />
        </MuiAnimatedSwitch>
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
