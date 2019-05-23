import React, { Component } from 'react';
import { Typography, Grid } from '@material-ui/core';
import { withStyles, Theme, createStyles, WithStyles } from '@material-ui/core/styles';
import DemoApp from './DemoApp';
import * as ConfigEditor from '../common/config/configEditor';
import Templater from '../common/config/configTemplater';
import { Server } from '../api/server';
import ServerMock from '../api/serverMock';
import DataMock from '../api/dataMock';
import randomUuid from '../common/util/uuid';
import Promised from '../common/Promised';
import PrioritizationControls from './landing/PrioritizationControls';
import LogIn from '../app/comps/LogIn';
import OnboardingDemo from './landing/OnboardingDemo';
import OnboardingControls from './landing/OnboardingControls';

interface Project {
  server: Server;
  templater: Templater;
  editor: ConfigEditor.Editor;
}

interface DemoProps {
  isEven:boolean;
  title:string;
  description:string;
  initialSubPath?:string;
  template?:(templater:Templater)=>void;
  mock?:(mocker:DataMock)=>Promise<any>;
  controls?:(project:Project)=>React.ReactNode;
  demo?:(project:Project)=>React.ReactNode;
}

const styles = (theme:Theme) => createStyles({
  page: {
  },
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
    width: '100vw',
    padding: '10vh 10vw 10vh',
  },
  demoApp: {
  },
});

/** Landing page brainstorm **
 * 
 * User feedback
 * 
 * DONE Prioritization
 * 
 * Frictionless onboarding and retention:
 * title:
 * description:
 * demo: sign up form
 * - Choose platform: Mobile, Desktop
 * - Choose onboarding: Mobile, Desktop
 * 
 * Analytics:
 * 
 * Customization:
 * Highly customizable
 * - Menu
 * - Style
 * 
 * Features (Demos):
 * - Funding Voting Expressions
 * 
 */
class LandingPage extends Component<WithStyles<typeof styles, true>> {

  render() {
    return (
      <div className={this.props.classes.page}>
        <div className={this.props.classes.hero}>
          {this.renderTitle()}
          {this.renderSubTitle()}
        </div>

        {this.renderPrioritization(true)}
        {this.renderOnboarding(false)}

        {/* Major templates (Feature ranking, blog, knowledge base, bug bounty, forum, FAQ, etc...)
        all-in-one customer feedback */}
        {/* Onboarding, minimal friction (SSO, email, Mobile push, Browser push, anonymous; email,pass,user req/opt)*/}
        {/* Funding (toggle credit types: time, currency, points, beer) */}
        {/* Voting (toggle downvotes) */}
        {/* Expressions (toggle whitelist (github, unlimited, custom)) */}
        {/* Layout (Rearrange menu and pages) */}
        {/* Statuses (name color next status), display workflow */}
        {/* Tagging (tag group name and tags) */}
        {/* Style (toggle dark mode, colors, fonts)*/}
      </div>
    );
  }

  renderTitle() {
    return (
      <Typography variant='h3' component='h1'>
        Clear Flask
      </Typography>
    );
  }
  renderSubTitle() {
    return (
      <Typography variant='h5' component='h2'>
        Give valuable customers a proportionate voice to drive your product
      </Typography>
    );
  }


  renderPrioritization(isEven:boolean) {
    return this.renderDemo({
      isEven,
      title: 'Give users fine control prioritizing features',
      description: 'Users',
      initialSubPath: '/embed/demo',
      template: templater => templater.demoPrioritization(),
      mock: mocker => mocker.demoPrioritization(),
      controls: project => (<PrioritizationControls templater={project.templater} />),
    });
  }

  renderOnboarding(isEven:boolean) {
    return this.renderDemo({
      isEven,
      title: 'Frictionless user onboarding',
      description: 'The intention is to retain users unhappy with your product. We collect only enough information to ',
      // description: 'We recommend using Single Sign-On to allow users to seamlessly transition from your product to our feedback platform.'
      //  + 'Otherwise we ask for minimal information',
      initialSubPath: '/embed/demo',
      controls: project => (<OnboardingControls templater={project.templater} />),
      demo: project => (<OnboardingDemo server={project.server} />),
    });
  }

  renderDemo(demoProps:DemoProps) {
    const projectPromise = this.getProject(demoProps.template, demoProps.mock);
    const controls = demoProps.controls === undefined ? undefined : (
      <Promised promise={projectPromise} render={demoProps.controls} />
    );
    const textContainer = (
      <Grid item xs={12} sm={5} md={4} lg={3} xl={2}>
        <Typography variant='h5' component='h3'>{demoProps.title}</Typography>
        <br />
        <Typography variant='subtitle1' component='div'>{demoProps.description}</Typography>
        <br />
        {controls}
      </Grid>
    );
    const spacing = (<Grid item xs={false} sm={false} md={2} lg={1} xl={false} />);
    const app = (
      <Grid item xs={12} sm={6} className={this.props.classes.demoApp}>
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
        spacing={24}
        direction={ demoProps.isEven ? 'row-reverse' : undefined }
        wrap='wrap-reverse'
      >
        {app}
        {spacing}
        {textContainer}
      </Grid>
    );
  }

  getProject(
    template:((templater:Templater)=>void)|undefined = undefined,
    mock:((mocker:DataMock)=>void)|undefined = undefined
  ):Promise<Project> {
    const projectId = randomUuid();
    const server = new Server(projectId, ServerMock.get());
    return server.dispatchAdmin()
      .then(d => d.projectCreateAdmin({projectId: projectId})
        .then(project =>{
          const editor = new ConfigEditor.EditorImpl(project.config.config);
          const templater = Templater.get(editor);
          template && template(templater);
          server.subscribeToChanges(editor);
          return d.configSetAdmin({
            projectId: projectId,
            versionLast: project.config.version,
            config: editor.getConfig(),
          })
          .then(() => mock && mock(DataMock.get(projectId)))
          .then(() => {
            if(server.getStore().getState().users.loggedIn.status === undefined) {
              server.dispatch().userBind({projectId});
            }
          })
          .then(() => server.dispatch().configGet({projectId: projectId}))
          .then(() => ({server, templater, editor}));
        })
      );
  }
}

export default withStyles(styles, { withTheme: true })(LandingPage);
