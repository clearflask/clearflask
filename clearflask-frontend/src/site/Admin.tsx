import React, { Component } from 'react';
import * as ConfigEditor from '../common/config/configEditor';
import Menu, { MenuProject, MenuDivider, MenuItem } from '../common/config/settings/Menu';
import Page from '../common/config/settings/Page';
import { match } from 'react-router';
import { History, Location } from 'history';
import Message from '../app/comps/Message';
import DemoApp from './DemoApp';
import Layout from '../common/Layout';
import { Divider, Typography, ListItem } from '@material-ui/core';
import { Server } from '../api/server';
import * as AdminClient from '../api/admin';
import { detectEnv, Environment } from '../common/util/detectEnv';
import ConfigView from '../common/config/settings/ConfigView';
import ServerAdmin from '../api/serverAdmin';
import Crumbs from '../common/config/settings/Crumbs';

export interface Project {
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

export default class Admin extends Component<Props, State> {
  readonly serverAdmin:ServerAdmin;
  readonly menuItems:{[slug:string]:(MenuItem&{content:()=>React.ReactNode})} = {
    '': {
      slug: '',
      type: 'item',
      name: 'Home',
      content: () => (<div>This is home</div>),
    }
  };
  projects:{[projectId:string]: Project} = {};
  
  constructor(props:Props) {
    super(props);

    this.state = {currentPagePath: []}

    this.serverAdmin = new ServerAdmin();

    if(detectEnv() === Environment.DEVELOPMENT_FRONTEND) {
      this.loadProjects({
        configs: [
          new ConfigEditor.EditorImpl().getConfig(),
          new ConfigEditor.EditorImpl().getConfig(),
          new ConfigEditor.EditorImpl().getConfig(),
          new ConfigEditor.EditorImpl().getConfig(),
          new ConfigEditor.EditorImpl().getConfig(),
        ]
      });
    } else {
      this.serverAdmin.dispatchAdmin().then(d => d.configGetAllAdmin().then(this.loadProjects.bind(this)));
    }
  }

  loadProjects(projects:AdminClient.Projects) {
    projects.configs.forEach(config => {
      const editor = new ConfigEditor.EditorImpl(config);
      const server = new Server(config.projectId);
      server.subscribeToChanges(editor);
      this.projects[config.projectId] = {
        editor: editor,
        server: server,
      };
    });
    this.forceUpdate();
  }

  render() {
    const activePath = this.props.match.params['path'] || '';
    const activeSubPath = ConfigEditor.parsePath(this.props.match.params['subPath'], '/');
    const activeMenuItem = this.menuItems[activePath];
    const activeProject = this.projects[activePath];
    var page;
    var preview;
    if(activeMenuItem) {
      page = activeMenuItem.content();
    } else if(activeProject) {
      try {
        var currentPage = activeProject.editor.getPage(activeSubPath);
      } catch(ex) {
        return (
          <Message innerStyle={{margin: '40px auto'}}
            message='Oops, page failed to load'
            variant='error'
          />
        );
      }
      page = (
        <Page
          key={activePath}
          page={currentPage}
          editor={activeProject.editor}
          pageClicked={path => this.pageClicked(activePath, path)}
        />
      );
      preview = (
        <DemoApp
          key={activePath}
          editor={activeProject.editor}
          server={activeProject.server} />
      );
    }
    return (
      <Layout
        toolbarLeft={
          <Typography variant="h6" color="inherit" noWrap>
            Admin
          </Typography>
        }
        preview={preview}
        menu={(
          <Menu
            items={[
              ...(Object.values(this.menuItems)),
              ...(Object.keys(this.projects).length > 0 ? [{type: 'divider'} as MenuDivider] : []),
              ...(Object.keys(this.projects).map(projectId => {
                const project = this.projects[projectId];
                const menuProject:MenuProject = {
                  type: 'project',
                  projectId: project.server.getProjectId(),
                  page: project.editor.getPage([]),
                };
                return menuProject;
              })),
            ]}
            activePath={activePath}
            activeSubPath={activeSubPath}
            pageClicked={this.pageClicked.bind(this)}
          />
        )}
      >
        {[
          <Crumbs
            activeItem={activeMenuItem}
            activeProject={activeProject}
            activeSubPath={activeSubPath}
            pageClicked={this.pageClicked.bind(this)}
          />,
          page,
        ]}
        {/* TODO remove <ConfigView editor={this.editor} /> */}
      </Layout>
    );
  }

  pageClicked(path:string, subPath:ConfigEditor.Path = []):void {
    this.props.history.push(`/admin/${[path, ...subPath].join('/')}`);
  }
}
