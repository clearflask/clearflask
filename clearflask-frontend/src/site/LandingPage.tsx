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
import OnboardingDemo from './landing/OnboardingDemo';
import OnboardingControls, { setInitSignupMethodsTemplate } from './landing/OnboardingControls';

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
    [theme.breakpoints.up('md')]: {
      padding: '10vh 10vw 10vh',
    },
    [theme.breakpoints.down('sm')]: {
      padding: '10vh 1vw 10vh',
    },
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
        {this.renderAnalytics(true)}

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
        Give valuable customers a proportionate voice to drive your product
      </Typography>
    );
  }
  renderSubTitle() {
    return (
      <Typography variant='h5' component='h2'>
        A platform to collect and organize user feedback so you can implement the next most beneficial feature.
      </Typography>
    );
  }

  onboardingDemoRef:React.RefObject<any> = React.createRef();
  renderPrioritization(isEven:boolean) {
    return this.renderDemo({
      isEven,
      title: 'Give users ability to convey the value of features',
      description: 'Feature prioritization is critical to your success.'
        + ' Give users proportionate amount of credits based on their value to you.'
        + ' Alterntatively, let users support your development by purchasing credits to choose which feature you build next.',
      initialSubPath: '/embed/demo',
      template: templater => templater.demoPrioritization(),
      mock: mocker => mocker.demoPrioritization(),
      controls: project => (<PrioritizationControls templater={project.templater} />),
    });
  }

  renderOnboarding(isEven:boolean) {
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

  renderAnalytics(isEven:boolean) {
    return this.renderDemo({
      isEven,
      title: 'Analytics',
      description: 
      'Lorem ipsum dolor sit amet consectetur, adipisicing elit. Error, aperiam. Sapiente quibusdam atque praesentium quidem nemo inventore numquam eaque aperiam? Maxime quasi laborum accusamus amet eum ea cum reprehenderit natus.',
      initialSubPath: '/admin/demo',
      template: templater => templater.demo(),
      mock: mocker => mocker.mockAll(),
      demo: project => (<div>TODO show analytics page</div>),
    });
  }

  renderDemo(demoProps:DemoProps) {
    const projectPromise = this.getProject(demoProps.template, demoProps.mock);
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
      <Grid item xs={12} md={6} className={this.props.classes.demoApp}>
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
