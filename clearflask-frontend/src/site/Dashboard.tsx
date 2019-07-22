import React, { Component } from 'react';
import * as ConfigEditor from '../common/config/configEditor';
import Menu, { MenuProject } from '../common/config/settings/Menu';
import Page from '../common/config/settings/Page';
import { match } from 'react-router';
import { History, Location } from 'history';
import Message from '../app/comps/Message';
import DemoApp from './DemoApp';
import Layout from '../common/Layout';
import { Typography } from '@material-ui/core';
import { Server } from '../api/server';
import * as AdminClient from '../api/admin';
import { detectEnv, Environment } from '../common/util/detectEnv';
import ServerAdmin from '../api/serverAdmin';
import Crumbs from '../common/config/settings/Crumbs';
import Templater from '../common/config/configTemplater';
import DataMock from '../api/dataMock';
import ServerMock from '../api/serverMock';
import AddIcon from '@material-ui/icons/Add';
import randomUuid from '../common/util/uuid';

export interface Project {
  configVersion:string;
  editor:ConfigEditor.Editor;
  server:Server;
}

interface Props {
  // Router matching
  match:match;
  history:History;
  location:Location;
}

interface State {
  currentPagePath:ConfigEditor.Path;
}

export default class Dashboard extends Component<Props, State> {
  projects:{[projectId:string]: Project} = {};
  
  constructor(props:Props) {
    super(props);

    this.state = {currentPagePath: []}

    if(detectEnv() === Environment.DEVELOPMENT_FRONTEND) {
      const projectId = 'mock';
      ServerAdmin.get().dispatchAdmin()
        .then(d => d.projectCreateAdmin({projectId: projectId})
          .then(project =>{
            const editor = new ConfigEditor.EditorImpl(project.config.config);
            Templater.get(editor).demo();
            return d.configSetAdmin({
              projectId: projectId,
              versionLast: project.config.version,
              config: editor.getConfig(),
            });
          })
          .then(() => DataMock.get(projectId).mockAll())
          .then(() => d.configGetAllAndAccountBindAdmin()))
        .then((result:AdminClient.ConfigAllAndAccountResult) => result.configs)
        .then(this.loadProjects.bind(this));
    } else {
      ServerAdmin.get().dispatchAdmin()
        .then(d => d.configGetAllAndAccountBindAdmin())
        .then((result:AdminClient.ConfigAllAndAccountResult) => result.configs)
        .then(this.loadProjects.bind(this));
    }
  }

  loadProjects(configs:AdminClient.VersionedConfigAdmin[]) {
    configs.forEach(versionedConfig => this.loadProject(versionedConfig, true));
    this.forceUpdate();
  }

  loadProject(versionedConfig:AdminClient.VersionedConfigAdmin, suppressUpdate:boolean = false) {
    const server = ServerAdmin.get().createServer(versionedConfig.config.projectId);
    const editor = new ConfigEditor.EditorImpl(versionedConfig.config);
    server.subscribeToChanges(editor, 200);
    this.projects[versionedConfig.config.projectId] = {
      configVersion: versionedConfig.version,
      editor: editor,
      server: server,
    };
    if(!suppressUpdate) this.forceUpdate();
  }

  render() {
    const activePath = this.props.match.params['path'] || '';
    const activeSubPath = ConfigEditor.parsePath(this.props.match.params['subPath'], '/');
    const activeProject = this.projects[activePath];
    var page;
    var preview;
    var crumbs:{name:string, slug:string}[]|undefined;
    switch(activePath) {
      case '':
        page = (<div>This is home</div>);
        crumbs = [{name: 'Home', slug: activePath}];
        break;
      case 'projects':
        page = (<div>This is projects</div>);
        crumbs = [{name: 'Projects', slug: activePath}];
        break;
      case 'billing':
        page = (<div>This is billing</div>);
        crumbs = [{name: 'Billing', slug: activePath}];
        break;
      default:
        const activeProject = this.projects[activePath];
        try {
          var currentPage = activeProject.editor.getPage(activeSubPath);
        } catch(ex) {
          page = (
            <Message innerStyle={{margin: '40px auto'}}
              message='Oops, page failed to load'
              variant='error'
            />
          );
          break;
        }
        var forcePath;
        if(activeSubPath.length >= 3
          && activeSubPath[0] === 'layout'
          && activeSubPath[1] === 'pages') {
          const pageIndex = activeSubPath[2];
          forcePath = '/' + (activeProject.editor.getProperty(['layout', 'pages', pageIndex, 'slug']) as ConfigEditor.StringProperty).value;
        }
        page = (
          <Page
            key={currentPage.key}
            page={currentPage}
            editor={activeProject.editor}
            pageClicked={path => this.pageClicked(activePath, path)}
          />
        );
        preview = (
          <DemoApp
            key={activeProject.configVersion}
            server={activeProject.server}
            forcePath={forcePath}
          />
        );
        break;
    }
    return (
      <Layout
        toolbarLeft={
          <Typography variant='h6' color="inherit" noWrap>
            Dashboard
          </Typography>
        }
        preview={preview}
        menu={(
          <Menu
            /**
             * TODO Brainstorm admin features:
             * - Create/delete project
             * - Analytics
             * - Billing, plan, invoices, month estimate, stats
             * - Account (email password 2fa)
             */
            items={[
              { type: 'item', slug: '', name: 'Home' },
              { type: 'heading', text: 'Account' },
              { type: 'item', slug: 'projects', name: 'Projects', offset: 1 },
              { type: 'item', slug: 'billing', name: 'Billing', offset: 1 },
              { type: 'heading', text: 'Project' },
              ...(Object.keys(this.projects).map(projectId => {
                const project = this.projects[projectId];
                const menuProject:MenuProject = {
                  type: 'project',
                  projectId: project.server.getProjectId(),
                  page: project.editor.getPage([]),
                };
                return menuProject;
              })),
              { type: 'item', offset: 1, name: (
                  <span style={{display: 'flex', alignItems: 'center'}}>
                    <AddIcon fontSize='inherit' />
                    &nbsp;
                    Create
                  </span>
                ), onClick: () => {
                  ServerAdmin.get().dispatchAdmin().then(d => {
                    d.projectCreateAdmin({ projectId: 'App-' + randomUuid().substring(0,6) })
                      .then(c => this.loadProject(c.config));
                  });
              } },
            ]}
            activePath={activePath}
            activeSubPath={activeSubPath}
            pageClicked={this.pageClicked.bind(this)}
          />
        )}
      >
        {[
          <Crumbs
            crumbs={crumbs}
            activeProject={activeProject}
            activeSubPath={activeSubPath}
            pageClicked={this.pageClicked.bind(this)}
          />,
          page,
        ]}
        {/* TODO remove */}
        {/* {activeProject && (<ConfigView editor={activeProject.editor} />)} */}
      </Layout>
    );
  }

  pageClicked(path:string, subPath:ConfigEditor.Path = []):void {
    this.props.history.push(`/dashboard/${[path, ...subPath].join('/')}`);
  }
}
