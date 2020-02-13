import React, { Component } from 'react';
import { Route, RouteComponentProps } from 'react-router';
import LandingPage from './LandingPage';
import { Slide, AppBar, Container, Toolbar, Typography, Button, Link } from '@material-ui/core';
import useScrollTrigger from '@material-ui/core/useScrollTrigger';
import { withStyles, Theme, createStyles, WithStyles } from '@material-ui/core/styles';
import MuiAnimatedSwitch from '../common/MuiAnimatedSwitch';
import { getProject, Project } from './DemoApp';
import Promised from '../common/Promised';
import App from '../app/App';
import PricingPage from './PricingPage';
import SignupPage from './SignupPage';
import SigninPage from './SigninPage';

const styles = (theme:Theme) => createStyles({
  toolbar: {
    display: 'flex',
  },
  grow: {
    flexGrow: 1,
  },
  appBarSpacer: theme.mixins.toolbar,
  appbar: {
    borderBottom: '1px solid ' + theme.palette.grey[300],
  },
});

class Site extends Component<RouteComponentProps&WithStyles<typeof styles, true>> {
  projectPromise:undefined|Promise<Project>;

  render() {
    return (
      <React.Fragment>
        {/* <HideOnScroll> */}
          <AppBar position='relative' color='inherit' elevation={0} className={this.props.classes.appbar}>
            <Container maxWidth='md'>
              <Toolbar className={this.props.classes.toolbar}>
                <img
                  style={{
                    width: '48px',
                    height: '48px',
                  }}
                  src='/clearflask-logo.png' />
                <Button
                  style={{textTransform: 'unset'}}
                  onClick={() => this.props.history.push('/')}
                >
                  <Typography variant="h6">Clear Flask</Typography>
                </Button>
                <div className={this.props.classes.grow} />
                <Button onClick={() => this.props.history.push('/')}>Home</Button>
                <Button onClick={() => this.props.history.push('/demo')}>Demo</Button>
                <Button onClick={() => this.props.history.push('/pricing')}>Pricing</Button>
                <Button onClick={() => this.props.history.push('/dashboard')}>Dashboard</Button>
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
          <Route exact path={'/signup'} render={props => (
            <SignupPage {...props} />
          )} />
          <Route path={`/:projectId(demo)`} render={props => {
            if(!this.projectPromise) this.projectPromise = getProject(
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
      </React.Fragment>
    );
  }
}

function HideOnScroll(props) {
  const trigger = useScrollTrigger();
  return (
    <Slide appear={false} direction="down" in={!trigger}>
      {props.children}
    </Slide>
  );
}

export default withStyles(styles, { withTheme: true })(Site);
