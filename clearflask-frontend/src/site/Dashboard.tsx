import React, { Component } from 'react';
import * as ConfigEditor from '../common/config/configEditor';
import Menu, { MenuProject } from '../common/config/settings/Menu';
import Page from '../common/config/settings/Page';
import { RouteComponentProps, Redirect } from 'react-router';
import Message from '../app/comps/Message';
import DemoApp from './DemoApp';
import Layout from '../common/Layout';
import { Typography, IconButton, Button } from '@material-ui/core';
import * as AdminClient from '../api/admin';
import ServerAdmin, { ReduxStateAdmin, Project } from '../api/serverAdmin';
import Crumbs from '../common/config/settings/Crumbs';
import AddIcon from '@material-ui/icons/Add';
import randomUuid from '../common/util/uuid';
import { connect } from 'react-redux';
import { Status } from '../api/server';
import LogoutIcon from '../common/icon/LogoutIcon';
import LoadingPage from '../app/LoadingPage';

interface Props {
}
interface ConnectProps {
  isLoggedIn?:boolean;
  configsStatus?:Status;
  configs?:AdminClient.VersionedConfigAdmin[];
}

interface State {
  currentPagePath:ConfigEditor.Path;
}

class Dashboard extends Component<Props&ConnectProps&RouteComponentProps, State> {
  unsubscribes:{[projectId:string]: ()=>void} = {};

  constructor(props) {
    super(props);

    if(props.isLoggedIn && !props.configsStatus) {
      ServerAdmin.get().dispatchAdmin().then(d => d.configGetAllAdmin());
    }

    this.state = {currentPagePath: []};
  }

  componentWillUnmount() {
    Object.values(this.unsubscribes).forEach(unsubscribe => unsubscribe());
  }

  render() {
    if(!this.props.isLoggedIn) {
      return (<Redirect to={{
        pathname: "/login",
        state: {ADMIN_LOGIN_REDIRECT_TO: this.props.location}
      }} />);
    } else if (this.props.configsStatus !== Status.FULFILLED || !this.props.configs) {
      return (<LoadingPage />);
    }
    const projects = this.props.configs.map(c => ServerAdmin.get().getProject(c));
    projects.forEach(project => {
      if(!this.unsubscribes[project.projectId]) {
        this.unsubscribes[project.projectId] = project.subscribeToUnsavedChanges(() => {
          this.forceUpdate();
        });
      }
    });

    const activePath = this.props.match.params['path'] || '';
    const activeSubPath = ConfigEditor.parsePath(this.props.match.params['subPath'], '/');
    const activeProject = projects.find(p => p.projectId === activePath);
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
        if(activeProject === undefined) {
          page = (
            <Message innerStyle={{margin: '40px auto'}}
            message='Oops, cannot find project'
              variant='error'
            />
          );
          break;
        }
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
        toolbarRight={
          <IconButton
            color="inherit"
            aria-label="Preview changes"
            onClick={() => ServerAdmin.get().dispatchAdmin().then(d => d.accountLogoutAdmin())}
          >
            <LogoutIcon />
          </IconButton>
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
              ...(projects.map(project => {
                const menuProject:MenuProject = {
                  type: 'project',
                  projectId: project.server.getProjectId(),
                  page: project.editor.getPage([]),
                  hasUnsavedChanges: project.hasUnsavedChanges(),
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
                    d.projectCreateAdmin({ projectId: 'project-' + randomUuid().substring(0,6) });
                  });
              } },
            ]}
            activePath={activePath}
            activeSubPath={activeSubPath}
            pageClicked={this.pageClicked.bind(this)}
          />
        )}
        barBottom={(activeProject && activeProject.hasUnsavedChanges()) ? (
          <React.Fragment>
            <Typography style={{flexGrow: 1}}>You have unsaved changes</Typography>
            <Button color='primary' onClick={() => {
              const currentProject = activeProject;
              currentProject.server.dispatchAdmin().then(d => d.configSetAdmin({
                projectId: currentProject.projectId,
                versionLast: currentProject.configVersion,
                configAdmin: currentProject.editor.getConfig(),
              })
              .then(() => {
                currentProject.resetUnsavedChanges()
              }));
            }}>Publish</Button>
          </React.Fragment>
        ) : undefined}
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


export default connect<ConnectProps,{},Props,ReduxStateAdmin>((state, ownProps) => {
  const connectProps:ConnectProps = {
    isLoggedIn: state.account.account.status === Status.FULFILLED,
    configsStatus: state.configs.configs.status,
    configs: state.configs.configs.configs && Object.values(state.configs.configs.configs),
  };
  return connectProps;
}, null, null, { forwardRef: true })(Dashboard);
