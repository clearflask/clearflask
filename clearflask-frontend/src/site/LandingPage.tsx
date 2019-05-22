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
import DividerCorner from '../app/utils/DividerCorner';

const styles = (theme:Theme) => createStyles({
  page: {
  },
  hero: {
    width: '100vw',
    minHeight: '100vh',
    padding: '10vh 10vw',
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
    height: '50vh',
  },
});

class LandingPage extends Component<WithStyles<typeof styles, true>> {

  render() {
    return (
      <div className={this.props.classes.page}>
        <div className={this.props.classes.hero}>
          {this.renderTitle()}
          {this.renderSubTitle()}
        </div>

        {/* Major templates (Feature ranking, blog, knowledge base, bug bounty, forum, FAQ, etc...)
        all-in-one customer feedback */}
        {/* Onboarding, minimal friction (SSO, email, Mobile push, Browser push, anonymous; email,pass,user req/opt)*/}
        {/* Voting (toggle downvotes) */}
        {this.renderVoting(true)}
        {/* Funding (toggle credit types: time, currency, points, beer) */}
        {this.renderFunding(false)}
        {/* Expressions (toggle whitelist (github, unlimited, custom)) */}
        {this.renderExpression(true)}
        {/* Layout (Rearrange menu and pages) */}
        {/* Statuses (name color next status), display workflow */}
        {/* Tagging (tag group name and tags) */}
        {/* Style (toggle dark mode, colors, fonts)*/}
      </div>
    );
  }

  renderTitle() {
    return (
      <Typography variant='h1'>
        Crowd-funded roadmap
      </Typography>
    );
  }
  renderSubTitle() {
    return (
      <Typography variant='h2'>
        Customer feedback platform prioritized based on their monetary contributions
      </Typography>
    );
  }

  renderExpression(isEven:boolean) {
    return this.renderDemo(
      isEven,
      'Expression',
      'Blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah',
      this.getDemoApp(
        templater => {
          const categoryIndex = templater.demoCategory();
          templater.supportExpressingGithubStyle(categoryIndex);
          templater.demoPagePanel();
        },
        mocker => mocker.mockAll(),
        '/embed/demo',
      ));
  }

  renderFunding(isEven:boolean) {
    return this.renderDemo(
      isEven,
      'Funding',
      'Blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah',
      this.getDemoApp(
        templater => {
          const categoryIndex = templater.demoCategory();
          templater.supportFunding(categoryIndex);
          templater.creditsCurrency();
          templater.demoPagePanel();
        },
        mocker => mocker.mockAll(),
        '/embed/demo',
      ));
  }

  renderVoting(isEven:boolean) {
    return this.renderDemo(
      isEven,
      'Voting',
      'Blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah',
      this.getDemoApp(
        templater => {
          const categoryIndex = templater.demoCategory();
          templater.supportVoting(categoryIndex, true);
          templater.demoPagePanel();
        },
        mocker => mocker.mockAll(),
        '/embed/demo',
      ));
  }

  renderDemo(isEven:boolean, heading:string, text:string, demo) {
    const textContainer = (
      <Grid item xs={12} sm={3}>
        <Typography variant='h5' component='h3'>{heading}</Typography>
        <br />
        <Typography variant='subtitle1' component='div'>{text}</Typography>
      </Grid>
    );
    const app = (
      <Grid item xs={12} sm={6} className={this.props.classes.demoApp}>
        {demo}
      </Grid>
    );

    return (
      <Grid
        className={this.props.classes.demo}
        container
        spacing={24}
        direction={ isEven ? 'row-reverse' : undefined }
        wrap='wrap-reverse'
      >
        {app}
        {textContainer}
      </Grid>
    );
  }

  getDemoApp(
    template:((templater:Templater)=>void)|undefined = undefined,
    mock:((mocker:DataMock)=>void)|undefined = undefined,
    initialSubPath?:string
  ):React.ReactNode {
    return (
      <DemoApp
        server={this.getDemoServer(template, mock)}
        intialSubPath={initialSubPath}
      />
    );
  }

  getDemoServer(
    template:((templater:Templater)=>void)|undefined = undefined,
    mock:((mocker:DataMock)=>void)|undefined = undefined
  ):Server {
    const projectId = randomUuid();
    const server = new Server(projectId, ServerMock.get());
    server.dispatchAdmin()
      .then(d => d.projectCreateAdmin({projectId: projectId})
        .then(project =>{
          const editor = new ConfigEditor.EditorImpl(project.config.config);
          template && template(Templater.get(editor));
          server.subscribeToChanges(editor);
          return d.configSetAdmin({
            projectId: projectId,
            versionLast: project.config.version,
            config: editor.getConfig(),
          });
        })
        .then(() => mock && mock(DataMock.get(projectId)))
        .then(() => {
          if(server.getStore().getState().users.loggedIn.status === undefined) {
            server.dispatch().userBind({projectId});
          }
        })
        .then(() => server.dispatch().configGet({projectId: projectId}))
      );
    return server;
  }
}

export default withStyles(styles, { withTheme: true })(LandingPage);
