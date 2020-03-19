import { Container, Grid, Hidden, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import DataMock from '../api/dataMock';
import Templater from '../common/config/configTemplater';
import { deleteProject, Project } from './DemoApp';
import Block from './landing/Block';
import Demo from './landing/Demo';
import PrioritizationControlsCredits from './landing/PrioritizationControlsCredits';
import PrioritizationControlsExpressions from './landing/PrioritizationControlsExpressions';
import PrioritizationControlsVoting from './landing/PrioritizationControlsVoting';

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

        {this.renderPrioritization()}
        {this.renderEngagement()}
        {this.renderTransparency()}

        {/* {this.renderPrioritizationDemo(true)}
        {this.renderOnboarding()} */}
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
              <Typography variant='h3' component='h1'>
                Give valuable customers a voice to drive your product
      </Typography>
              <Typography variant='h5' component='h2'>
                A tool to empower your users to voice their opinion for you to make better product decisions.
      </Typography>
            </Grid>
          </Grid>
        </Container>
      </div>
    );
  }

  renderPrioritization(mirror?: boolean) {
    return (
      <React.Fragment>
        <Demo
          title='Voting ideas'
          description='Simple to understand voting system'
          mirror={mirror}
          initialSubPath='/embed/demo'
          template={templater => templater.demoPrioritization('vote')}
          mock={mocker => mocker.demoPrioritization()}
          controls={project => (<PrioritizationControlsVoting templater={project.templater} />)}
        />
        <Demo
          title='Powerful Credit System'
          description='Assign credits based on user value. Let your users prioritize ideas by distributing credits.'
          mirror={mirror}
          initialSubPath='/embed/demo'
          template={templater => templater.demoPrioritization('fund')}
          mock={mocker => mocker.demoPrioritization()}
          controls={project => (<PrioritizationControlsCredits templater={project.templater} />)}
        />
        <Demo
          title='Expressions'
          description='Expressions with blah blah blah.'
          mirror={mirror}
          initialSubPath='/embed/demo'
          template={templater => templater.demoPrioritization('express')}
          mock={mocker => mocker.demoPrioritization()}
          controls={project => (<PrioritizationControlsExpressions templater={project.templater} />)}
        />
      </React.Fragment>
    );
  }

  renderEngagement(mirror?: boolean) {
    return (
      <Block
        title=''
        description=''
        mirror={mirror}
      />
    );
  }

  renderTransparency(mirror?: boolean) {
    return (
      <Block
        title=''
        description=''
        mirror={mirror}
      />
    );
  }

  // onboardingDemoRef: React.RefObject<any> = React.createRef();
  // renderOnboarding(mirror?: boolean) {
  //   return (
  //     <Demo
  //       mirror={mirror}
  //       title='Notify users when their wishes are fulfilled'
  //       description='It is important to keep a communication channel from users leaving feedback. To minimize friction, users can choose between browser push notifications, mobile push or standard email.'
  //       initialSubPath='/embed/demo'
  //       template={templater => setInitSignupMethodsTemplate(templater)}
  //       controls={project => (<OnboardingControls onboardingDemoRef={this.onboardingDemoRef} templater={project.templater} />)}
  //       demo={project => (<OnboardingDemo innerRef={this.onboardingDemoRef} server={project.server} />)}
  //     />
  //   );
  // }
}

export default withStyles(styles, { withTheme: true })(LandingPage);
