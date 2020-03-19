import { Container, Grid, Hidden, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import DataMock from '../api/dataMock';
import Templater from '../common/config/configTemplater';
import Promised from '../common/Promised';
import DemoApp, { deleteProject, getProject, Project } from './DemoApp';
import OnboardingControls, { setInitSignupMethodsTemplate } from './landing/OnboardingControls';
import OnboardingDemo from './landing/OnboardingDemo';
import PrioritizationControls from './landing/PrioritizationControls';

interface DemoProps {
  isEven: boolean;
  title: string;
  description: string;
  initialSubPath?: string;
  template?: (templater: Templater) => void;
  mock?: (mocker: DataMock) => Promise<any>;
  controls?: (project: Project) => React.ReactNode;
  demo?: (project: Project) => React.ReactNode;
}

const styles = (theme: Theme) => createStyles({
  hero: {
    width: '100vw',
    minHeight: '100vh',
    padding: '20vh 10vw',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  demo: {
    [theme.breakpoints.up('md')]: {
      padding: '10vh 10vw 10vh',
    },
    [theme.breakpoints.down('sm')]: {
      padding: '10vh 1vw 10vh',
    },
  },
  heroLogo: {
    [theme.breakpoints.up('sm')]: {
      width: '200px',
      height: '200px',
    },
    [theme.breakpoints.down('xs')]: {
      width: '100px',
      height: '100px',
    },
  },
});

class LandingPage extends Component<WithStyles<typeof styles, true>> {
  demoProjectIds: string[] = [];

  componentWillUnmount() {
    this.demoProjectIds.forEach(deleteProject);
  }

  render() {
    return (
      <React.Fragment>

        {this.renderHero()}

        {this.renderPrioritization(true)}
        {this.renderOnboarding(false)}
        {this.renderAnalytics(true)}
      </React.Fragment>
    );
  }

  renderHero() {
    return (
      <div className={this.props.classes.hero}>
        <Container maxWidth='md'>
          <Grid container justify='center' wrap='wrap-reverse' spacing={2}>
            <Hidden xsDown>
              <Grid item sm={4}>
                <img
                  alt='logo'
                  className={this.props.classes.heroLogo}
                  src='/clearflask-logo.png' />
              </Grid>
            </Hidden>
            <Grid item xs={12} sm={8}>
              {this.renderTitle()}
              {this.renderSubTitle()}
            </Grid>
          </Grid>
        </Container>
      </div>
    );
  }

  renderTitle() {
    return (
      <Typography variant='h3' component='h1'>
        Give valuable customers a voice to drive your product
      </Typography>
    );
  }
  renderSubTitle() {
    return (
      <Typography variant='h5' component='h2'>
        A tool to empower your users to voice their opinion for you to make better product decisions.
      </Typography>
    );
  }

  onboardingDemoRef: React.RefObject<any> = React.createRef();
  renderPrioritization(isEven: boolean) {
    return this.renderDemo({
      isEven,
      title: 'Give users ability to convey the value of features',
      description: 'Feature prioritization is critical to your success.'
        + ' Give users proportionate amount of credits based on their value to you.'
        + ' Alternatively, let users support your development by purchasing credits to choose which feature you build next.',
      initialSubPath: '/embed/demo',
      template: templater => templater.demoPrioritization(),
      mock: mocker => mocker.demoPrioritization(),
      controls: project => (<PrioritizationControls templater={project.templater} />),
    });
  }

  renderOnboarding(isEven: boolean) {
    return this.renderDemo({
      isEven,
      title: 'Notify users when their wishes are fulfilled',
      description:
        'It is important to keep a communication channel from users leaving feedback.'
        + 'To minimize friction, users can choose between browser push notifications, mobile push or standard email.',
      initialSubPath: '/embed/demo',
      template: templater => setInitSignupMethodsTemplate(templater),
      controls: project => (<OnboardingControls onboardingDemoRef={this.onboardingDemoRef} templater={project.templater} />),
      demo: project => (<OnboardingDemo innerRef={this.onboardingDemoRef} server={project.server} />),
    });
  }

  renderAnalytics(isEven: boolean) {
    return this.renderDemo({
      isEven,
      title: 'Analytics',
      description:
        'Lorem ipsum dolor sit amet consectetur, adipisicing elit. Error, aperiam. Sapiente quibusdam atque praesentium quidem nemo inventore numquam eaque aperiam? Maxime quasi laborum accusamus amet eum ea cum reprehenderit natus.',
      initialSubPath: '/dashboard/demo',
      template: templater => templater.demo(),
      mock: mocker => mocker.mockAll(),
      demo: project => (<div>TODO show analytics page</div>),
    });
  }

  renderDemo(demoProps: DemoProps) {
    const projectPromise = getProject(demoProps.template, demoProps.mock);
    projectPromise.then(project => this.demoProjectIds.push(project.server.getProjectId()));
    const controls = demoProps.controls === undefined ? undefined : (
      <Promised promise={projectPromise} render={demoProps.controls} />
    );
    const textContainer = (
      <Grid item xs={12} md={4} lg={3} xl={2}>
        <Typography variant='h5' component='h3'>{demoProps.title}</Typography>
        <br />
        <Typography variant='subtitle1' component='div'>{demoProps.description}</Typography>
        <br />
        {controls}
      </Grid>
    );
    const spacing = (<Grid item xs={false} sm={false} md={2} lg={1} xl={false} />);
    const app = (
      <Grid item xs={12} md={6}>
        <Promised promise={projectPromise} render={demoProps.demo || (project => (
          <DemoApp
            server={project.server}
            intialSubPath={demoProps.initialSubPath}
          />
        ))} />
      </Grid>
    );

    return (
      <Grid
        className={this.props.classes.demo}
        container
        spacing={3}
        direction={demoProps.isEven ? 'row-reverse' : undefined}
        wrap='wrap-reverse'
      >
        {app}
        {spacing}
        {textContainer}
      </Grid>
    );
  }
}

export default withStyles(styles, { withTheme: true })(LandingPage);
