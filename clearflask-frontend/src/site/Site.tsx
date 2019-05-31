import React, { Component } from 'react';
import { match, Route } from 'react-router';
import { History, Location } from 'history';
import LandingPage from './LandingPage';
import { Slide, AppBar, Container, Toolbar, Typography, Button } from '@material-ui/core';
import useScrollTrigger from '@material-ui/core/useScrollTrigger';
import { withStyles, Theme, createStyles, WithStyles } from '@material-ui/core/styles';
import MuiAnimatedSwitch from '../common/MuiAnimatedSwitch';
import DemoApp, { getProject, Project } from './DemoApp';
import Promised from '../common/Promised';
import App from '../app/App';
import PricingPage from './PricingPage';

interface Props {
  // Router matching
  match:match;
  history:History;
  location:Location;
}

const styles = (theme:Theme) => createStyles({
  toolbar: {
    display: 'flex',
  },
  grow: {
    flexGrow: 1,
  },
  appBarSpacer: theme.mixins.toolbar,
});

class Site extends Component<Props&WithStyles<typeof styles, true>> {
  projectPromise:undefined|Promise<Project>;

  render() {
    return (
      <React.Fragment>
        <HideOnScroll>
          <AppBar color='inherit' elevation={1}>
            <Container maxWidth='md'>
              <Toolbar className={this.props.classes.toolbar}>
                <Typography variant="h6">Clear Flask</Typography>
                <div className={this.props.classes.grow} />
                <Button onClick={() => this.props.history.push('/')}>Home</Button>
                <Button onClick={() => this.props.history.push('/demo')}>Demo</Button>
                <Button onClick={() => this.props.history.push('/pricing')}>Pricing</Button>
                <Button onClick={() => this.props.history.push('/contact')}>Contact</Button>
                <Button onClick={() => this.props.history.push('/dashboard')}>Dashboard</Button>
              </Toolbar>
            </Container>
          </AppBar>
        </HideOnScroll>
        <div className={this.props.classes.appBarSpacer} />
        <MuiAnimatedSwitch>
          <Route exact path={'/pricing'} render={props => (
            <PricingPage />
          )} />
          <Route path={`/:projectId(demo)`} render={props => {
            if(!this.projectPromise) this.projectPromise = getProject(
              templater => templater.demo(),
              mocker => mocker.mockAll(),
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
