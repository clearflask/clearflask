import { Button, IconButton, Typography } from '@material-ui/core';
import AddIcon from '@material-ui/icons/Add';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import { Redirect, RouteComponentProps, Route } from 'react-router';
import * as AdminClient from '../api/admin';
import { Status } from '../api/server';
import ServerAdmin, { ReduxStateAdmin } from '../api/serverAdmin';
import { SSO_TOKEN_PARAM_NAME } from '../app/App';
import LoadingPage from '../app/LoadingPage';
import * as ConfigEditor from '../common/config/configEditor';
import Crumbs from '../common/config/settings/Crumbs';
import Menu, { MenuHeading, MenuItem, MenuProject } from '../common/config/settings/Menu';
import Page from '../common/config/settings/Page';
import ProjectSettings from '../common/config/settings/ProjectSettings';
import LogoutIcon from '../common/icon/LogoutIcon';
import Layout from '../common/Layout';
import Message from '../common/Message';
import notEmpty from '../common/util/arrayUtil';
import setTitle from '../common/util/titleUtil';
import BillingPage from './dashboard/BillingPage';
import CreatePage from './dashboard/CreatePage';
import ExplorerPage from './dashboard/ExplorerPage';
import PostsPage from './dashboard/PostsPage';
import SettingsPage from './dashboard/SettingsPage';
import UsersPage from './dashboard/UsersPage';
import DemoApp, { getProject, Project } from './DemoApp';
import { isProd } from '../common/util/detectEnv';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js/pure';
import SubscriptionStatusNotifier from '../app/utils/SubscriptionStatusNotifier';
import MuiAnimatedSwitch from '../common/MuiAnimatedSwitch';
import { LoadingIndicator } from 'react-select/lib/components/indicators';

loadStripe.setLoadParameters({ advancedFraudSignals: false })
const stripePromise = loadStripe(isProd()
  ? 'pk_live_6HJ7aPzGuVyPwTX5ngwAw0Gh'
  : 'pk_test_M1ANiFgYLBV2UyeVB10w1Ons');

interface Props {
  forceMock?: boolean;
}
interface ConnectProps {
  accountStatus?: Status;
  account?: AdminClient.AccountAdmin;
  configsStatus?: Status;
  configs?: AdminClient.VersionedConfigAdmin[];
}
interface State {
  currentPagePath: ConfigEditor.Path;
  binding?: boolean;
}
class Dashboard extends Component<Props & ConnectProps & RouteComponentProps, State> {
  unsubscribes: { [projectId: string]: () => void } = {};
  createProjectPromise: Promise<Project> | undefined = undefined;
  createProject: Project | undefined = undefined;
  forcePathListener: ((forcePath: string) => void) | undefined;
  lastActiveprojectId: string | undefined;

  constructor(props) {
    super(props);

    if (props.accountStatus === undefined) {
      this.state = {
        currentPagePath: [],
        binding: true,
      };
      ServerAdmin.get(props.forceMock).dispatchAdmin()
        .then(d => d.accountBindAdmin({})
          .then(result => {
            this.setState({ binding: false })
            if (result.account) d.configGetAllAdmin()
          }));
    } else if (props.accountStatus === Status.FULFILLED && !props.configsStatus) {
      this.state = {
        currentPagePath: [],
      };
      ServerAdmin.get(props.forceMock).dispatchAdmin().then(d => d.configGetAllAdmin());
    } else {
      this.state = {
        currentPagePath: [],
      };
    }
  }

  componentWillUnmount() {
    Object.values(this.unsubscribes).forEach(unsubscribe => unsubscribe());
  }

  render() {
    if (!this.state.binding && this.props.accountStatus !== Status.FULFILLED && !this.props.account) {
      return (<Redirect to={{
        pathname: "/login",
        state: { ADMIN_LOGIN_REDIRECT_TO: this.props.location }
      }} />);
    } else if (this.props.configsStatus !== Status.FULFILLED || !this.props.configs) {
      return (<LoadingPage />);
    }
    const projects = this.props.configs.map(c => ServerAdmin.get(this.props.forceMock).getProject(c));
    projects.forEach(project => {
      if (!this.unsubscribes[project.projectId]) {
        this.unsubscribes[project.projectId] = project.subscribeToUnsavedChanges(() => {
          this.forceUpdate();
        });
      }
    });

    const activePath = this.props.match.params['path'] || '';
    const activeSubPath = ConfigEditor.parsePath(this.props.match.params['subPath'], '/');
    const activeProject = projects.find(p => p.projectId === activePath);

    var billingHasNotification: boolean = false;
    switch (this.props.account?.subscriptionStatus) {
      case AdminClient.SubscriptionStatus.ActiveTrial:
      case AdminClient.SubscriptionStatus.ActivePaymentRetry:
      case AdminClient.SubscriptionStatus.ActiveNoRenewal:
      case AdminClient.SubscriptionStatus.TrialExpired:
      case AdminClient.SubscriptionStatus.Blocked:
      case AdminClient.SubscriptionStatus.Cancelled:
        billingHasNotification = true;
        break;
      default:
      case AdminClient.SubscriptionStatus.Pending:
      case AdminClient.SubscriptionStatus.Active:
        break;
    }

    const prefixMatch = this.props.match.url.replace(/\/$/, '');

    return (
      <Elements stripe={stripePromise}>
        {this.props.account && (
          <SubscriptionStatusNotifier account={this.props.account} />
        )}
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
              onClick={() => ServerAdmin.get(this.props.forceMock).dispatchAdmin().then(d => d.accountLogoutAdmin())}
            >
              <LogoutIcon />
            </IconButton>
          }
          preview={(
            <MuiAnimatedSwitch>
              <Route exact path={`${prefixMatch}/create`} render={props => {
                return this.createProject ? (
                  <DemoApp
                    key={this.createProject.server.getStore().getState().conf.ver || 'preview-create-project'}
                    server={this.createProject.server}
                  />
                ) : (
                  <LoadingPage />
                );
              }} />
              <Route exact path={`${prefixMatch}/project/:projectId/settings`} render={props => {
                const activePath = props.match.params['project'] || '';
                const activeProject = projects.find(p => p.projectId === activePath);
                if (!activeProject) {
                  return null;
                }
                
                return (
                  <DemoApp
                    key={activeProject.configVersion}
                    server={activeProject.server}
                    forcePathSubscribe={listener => this.forcePathListener = listener}
                  />
                );
              }} />
            </MuiAnimatedSwitch>
          )}
          menu={(
            <Route path={`${prefixMatch}/project?/:projectId?`} render={props => {
              const projectId = props.match.params['projectId'] || '';
              const activeProject = projects.find(p => p.projectId === projectId);
              const hasProject = !!activeProject;

              return (
                <Menu
                  items={[
                    { type: 'item', slug: '', name: 'Home' } as MenuItem,
                    { type: 'heading', text: 'Explore' } as MenuHeading,
                    { type: 'item', slug: `project/${projectId}/posts`, name: 'Posts', disabled: hasProject, offset: 1 } as MenuItem,
                    { type: 'item', slug: `project/${projectId}/users`, name: 'Users', disabled: hasProject, offset: 1 } as MenuItem,
                    { type: 'item', slug: `project/${projectId}/moderators`, name: 'Moderators', disabled: hasProject, offset: 1 } as MenuItem,
                    { type: 'heading', text: 'Settings' } as MenuHeading,
                    ...(projects.map(project => {
                      const menuProject: MenuProject = {
                        type: 'project',
                        projectId: project.server.getProjectId(),
                        page: project.editor.getPage([]),
                        hasUnsavedChanges: project.hasUnsavedChanges(),
                      };
                      return menuProject;
                    })),
                    {
                      type: 'item', slug: 'create', name: (
                        <span style={{ display: 'flex', alignItems: 'center' }}>
                          <AddIcon fontSize='inherit' />&nbsp;Create
                        </span>
                      ), offset: 1
                    } as MenuItem,
                    { type: 'heading', text: 'Account' } as MenuHeading,
                    { type: 'item', slug: 'account', name: 'Settings', offset: 1 } as MenuItem,
                    { type: 'item', slug: 'billing', name: 'Billing', hasNotification: billingHasNotification, offset: 1 } as MenuItem,
                    { type: 'heading', text: 'Help' } as MenuHeading,
                    { type: 'item', name: 'Docs', offset: 1, onClick: () => this.openFeedback('docs') } as MenuItem,
                    { type: 'item', name: 'Roadmap', offset: 1, onClick: () => this.openFeedback('roadmap') } as MenuItem,
                    { type: 'item', name: 'Feedback', offset: 1, onClick: () => this.openFeedback('feedback') } as MenuItem,
                  ].filter(notEmpty)}
                  activePath={activePath}
                  activeSubPath={activeSubPath}
                  pageClicked={this.pageClicked.bind(this)}
                />
              );
            }} />
          )}
          barBottom={(activeProject && activeProject.hasUnsavedChanges()) ? (
            <React.Fragment>
              <Typography style={{ flexGrow: 1 }}>You have unsaved changes</Typography>
              <Button color='primary' onClick={() => {
                const currentProject = activeProject;
                currentProject.server.dispatchAdmin().then(d => d.configSetAdmin({
                  projectId: currentProject.projectId,
                  versionLast: currentProject.configVersion,
                  configAdmin: currentProject.editor.getConfig(),
                })
                  .then((versionedConfigAdmin) => {
                    currentProject.resetUnsavedChanges(versionedConfigAdmin)
                  }));
              }}>Publish</Button>
            </React.Fragment>
          ) : undefined}
        >
          <MuiAnimatedSwitch>
          <Route exact path={prefixMatch} render={props => {
              setTitle('Dashboard');
              return (
                <div>
                  This is home
                </div>
              );
            }} />
            <Route exact path={`${prefixMatch}/project/:projectId/posts/`} render={props => {
              setTitle('Posts - Dashboard');
              return (
                <ExplorerPage render={server => (
                  <PostsPage server={server} />
                )} />
              );
            }} />
            <Route exact path={`${prefixMatch}/project/:projectId/users`} render={props => {
              setTitle('Users - Dashboard');
              return (
                <ExplorerPage render={server => (
                  <UsersPage server={server} adminsOnly={false} />
                )} />
              );
            }} />
            <Route exact path={`${prefixMatch}/project/:projectId/moderators`} render={props => {
              setTitle('Moderators - Dashboard');
              return (
                <ExplorerPage render={server => (
                  <UsersPage server={server} adminsOnly={true} />
                )} />
              );
            }} />
            <Route exact path={`${prefixMatch}/billing`} render={props => {
              setTitle('Billing - Dashboard');
              return (
                <BillingPage />
              );
            }} />
            <Route exact path={`${prefixMatch}/account`} render={props => {
              setTitle('Account - Dashboard');
              return (
                <SettingsPage />
              );
            }} />
            <Route exact path={`${prefixMatch}/create`} render={props => {
              setTitle('Create Project - Dashboard');

              if (!this.createProjectPromise) {
                this.createProjectPromise = getProject(undefined, undefined, 'create-preview');
                this.createProjectPromise.then(project => {
                  this.createProject = project;
                  this.forceUpdate();
                })
              }
      
              return this.createProject ? (
                <CreatePage
                  previewProject={this.createProject}
                  pageClicked={(path, subPath) => this.pageClicked(path, subPath)}
                />
              ) : (
                <LoadingPage />
              );
            }} />
            <Route exact path={`${prefixMatch}/project/:projectId/settings/:subPath*`} render={props => {
              const activePath = props.match.params['projectId'] || '';
              const activeSubPath = ConfigEditor.parsePath(this.props.match.params['subPath'], '/');
              const activeProject = projects.find(p => p.projectId === activePath);
              if (!activeProject) {
                setTitle('Project not found - Dashboard');
                return (
                  <Message innerStyle={{ margin: '40px auto' }}
                    message='Oops, cannot find project'
                    variant='error'
                  />
                );
              }
              try {
                var currentPage = activeProject.editor.getPage(activeSubPath);
              } catch (er) {
                setTitle('Settings not found - Dashboard');
                return (
                  <Message innerStyle={{ margin: '40px auto' }}
                    message='Oops, cannot find settings'
                    variant='error'
                  />
                );
              }
              
              if (!!this.forcePathListener
                && activeSubPath.length >= 3
                && activeSubPath[0] === 'layout'
                && activeSubPath[1] === 'pages') {
                const pageIndex = activeSubPath[2];
                const forcePath = '/' + (activeProject.editor.getProperty(['layout', 'pages', pageIndex, 'slug']) as ConfigEditor.StringProperty).value;
                this.forcePathListener(forcePath);
              }

              setTitle(`${activeProject.server.getStore().getState().conf.conf?.name || 'Unnamed'} - Dashboard`);
              return (
                <React.Fragment>
                  <Crumbs
                    activeProject={activeProject}
                    activeSubPath={activeSubPath}
                    pageClicked={this.pageClicked.bind(this)}
                  />
                  <Page
                    key={currentPage.key}
                    page={currentPage}
                    editor={activeProject.editor}
                    pageClicked={path => this.pageClicked(activePath, path)}
                  />
                  {currentPage.path.length <= 0 && (
                    <ProjectSettings
                      server={activeProject.server}
                      pageClicked={this.pageClicked.bind(this)}
                    />
                  )}
                </React.Fragment>
              );
            }} />
            <Route render={props => {
              setTitle('Page not found - Dashboard');
              return (
                <Message innerStyle={{ margin: '40px auto' }}
                  message='Oops, cannot find page'
                  variant='error'
                />
              );
            }} />
          </MuiAnimatedSwitch>
          {/* TODO remove */}
          {/* {activeProject && (<ConfigView editor={activeProject.editor} />)} */}
        </Layout>
      </Elements>
    );
  }

  openFeedback(page?: string) {
    window.open(`${window.location.protocol}//feedback.${window.location.host}/${page || ''}?${SSO_TOKEN_PARAM_NAME}=${this.props.account?.cfJwt}`, '_blank')
  }

  pageClicked(path: string, subPath: ConfigEditor.Path = []): void {
    this.props.history.push(`/dashboard/${[path, ...subPath].join('/')}`);
  }
}


export default connect<ConnectProps, {}, Props, ReduxStateAdmin>((state, ownProps) => {
  const connectProps: ConnectProps = {
    accountStatus: state.account.account.status,
    account: state.account.account.account,
    configsStatus: state.configs.configs.status,
    configs: state.configs.configs.configs && Object.values(state.configs.configs.configs),
  };
  return connectProps;
}, null, null, { forwardRef: true })(Dashboard);
