import { Button, IconButton, Typography } from '@material-ui/core';
import AddIcon from '@material-ui/icons/Add';
import React, { Component } from 'react';
import { connect, Provider } from 'react-redux';
import { Redirect, RouteComponentProps } from 'react-router';
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
import SelectionPicker, { Label } from '../app/comps/SelectionPicker';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import ErrorPage from '../app/ErrorPage';

loadStripe.setLoadParameters({ advancedFraudSignals: false })
const stripePromise = loadStripe(isProd()
  ? 'pk_live_6HJ7aPzGuVyPwTX5ngwAw0Gh'
  : 'pk_test_M1ANiFgYLBV2UyeVB10w1Ons');

const styles = (theme: Theme) => createStyles({
  toolbarLeft: {
    display: 'flex',
    alignItems: 'baseline'
  },
  projectPicker: {
    marginLeft: theme.spacing(2),
  },
  selectProjectLabel: {
    fontStyle: 'italic',
  },
});
 
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
  selectedProjectLabel?: Label;
}

class Dashboard extends Component<Props & ConnectProps & RouteComponentProps & WithStyles<typeof styles, true>, State> {
  unsubscribes: { [projectId: string]: () => void } = {};
  createProjectPromise: Promise<Project> | undefined = undefined;
  createProject: Project | undefined = undefined;
  forcePathListener: ((forcePath: string) => void) | undefined;

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
    const activePath = this.props.match.params['path'] || '';
    const activeSubPath = ConfigEditor.parsePath(this.props.match.params['subPath'], '/');
    const projects = this.props.configs.map(c => ServerAdmin.get(this.props.forceMock).getProject(c));
    projects.forEach(project => {
      if (!this.unsubscribes[project.projectId]) {
        this.unsubscribes[project.projectId] = project.subscribeToUnsavedChanges(() => {
          this.forceUpdate();
        });
      }
    });

    const noProjectLabel = {label: (
      <span className={this.props.classes.selectProjectLabel}>
        Select project
      </span>
    ), value: '__NONE__'};
    const createLabel = {label: (
      <span style={{ display: 'flex', alignItems: 'center' }}>
        <AddIcon fontSize='inherit' />&nbsp;Create
      </span>
    ), value: '__CREATE__'};
    const projectOptions = [
      ...(projects.length > 0
        ? projects.map(p => ({ label: p.editor.getConfig().name, value: p.projectId }))
        : [noProjectLabel]),
      createLabel,
    ];
    var selectedLabel: Label | undefined;
    var activeProjectId: string | undefined;
    if (activePath === 'create') {
      selectedLabel = createLabel;
    } else if (this.state.selectedProjectLabel && projectOptions.some(o => o.value === this.state.selectedProjectLabel?.value)) {
      selectedLabel = this.state.selectedProjectLabel;
      activeProjectId = this.state.selectedProjectLabel.value;
    } else if (projects.length > 0) {
      selectedLabel = {label: projects[0].editor.getConfig().name, value: projects[0].projectId };
      activeProjectId = projects[0].projectId;
    } else {
      selectedLabel = noProjectLabel;
    }
    const activeProject = projects.find(p => p.projectId === activeProjectId);

    var page;
    var preview;
    var crumbs: { name: string, slug: string }[] | undefined;
    switch (activePath) {
      case '':
        setTitle('Dashboard');
        page = (<div>This is home</div>);
        crumbs = [{ name: 'Home', slug: activePath }];
        break;
      case 'posts':
        setTitle('Posts - Dashboard');
        page = activeProject ? (
          <Provider key={activeProject.projectId} store={activeProject.server.getStore()}>
            <PostsPage server={activeProject.server} />
          </Provider>
        ) : (
          <ErrorPage msg='Select a project' />
        );
        crumbs = [{ name: 'Posts', slug: activePath }];
        break;
      // case 'comments':
      //   setTitle('Comments');
      //   page = (<div>This is comments</div>);
      //   crumbs = [{name: 'Comments', slug: activePath}];
      //   break;
      case 'users':
      case 'moderators':
        setTitle('Users - Dashboard');
        page = activeProject ? (
          <Provider key={activeProject.projectId} store={activeProject.server.getStore()}>
            <UsersPage key={activePath} server={activeProject.server} adminsOnly={activePath === 'moderators'} />
          </Provider>
        ) : (
          <ErrorPage msg='Select a project' />
        );
        crumbs = [{ name: 'Users', slug: activePath }];
        break;
      case 'billing':
        setTitle('Billing - Dashboard');
        page = (<BillingPage />);
        crumbs = [{ name: 'Billing', slug: activePath }];
        break;
      case 'account':
        setTitle('Account - Dashboard');
        page = (<SettingsPage />);
        crumbs = [{ name: 'Settings', slug: activePath }];
        break;
      case 'create':
        setTitle('Create - Dashboard');
        if (!this.createProjectPromise) {
          this.createProjectPromise = getProject(undefined, undefined, 'create-preview');
          this.createProjectPromise.then(project => {
            this.createProject = project;
            this.forceUpdate();
          })
        }
        page = this.createProject && (
          <CreatePage
            previewProject={this.createProject}
            pageClicked={(path, subPath) => this.pageClicked(path, subPath)}
          />
        );
        crumbs = [{ name: 'Create', slug: activePath }];
        preview = this.createProject && (
          <DemoApp
            key={this.createProject.server.getStore().getState().conf.ver || 'preview-create-project'}
            server={this.createProject.server}
          />
        );
        break;
      default:
        if (activeProject === undefined) {
          setTitle('Page not found');
          page = (
            <Message innerStyle={{ margin: '40px auto' }}
              message='Oops, cannot find project'
              variant='error'
            />
          );
          break;
        }
        try {
          var currentPage = activeProject.editor.getPage(activeSubPath);
        } catch (ex) {
          setTitle('Page not found');
          page = (
            <Message innerStyle={{ margin: '40px auto' }}
              message='Oops, page failed to load'
              variant='error'
            />
          );
          break;
        }
        if (!!this.forcePathListener
          && activeSubPath.length >= 3
          && activeSubPath[0] === 'layout'
          && activeSubPath[1] === 'pages') {
          const pageIndex = activeSubPath[2];
          const forcePath = '/' + (activeProject.editor.getProperty(['layout', 'pages', pageIndex, 'slug']) as ConfigEditor.StringProperty).value;
          this.forcePathListener(forcePath);
        }
        setTitle(activeProject.server.getStore().getState().conf.conf?.name);
        page = (
          <Page
            key={currentPage.key}
            page={currentPage}
            editor={activeProject.editor}
            pageClicked={path => this.pageClicked(activePath, path)}
          />
        );
        if (currentPage.path.length <= 0) {
          page = (
            <React.Fragment>
              {page}
              <ProjectSettings
                server={activeProject.server}
                pageClicked={this.pageClicked.bind(this)}
              />
            </React.Fragment>
          );
        }
        preview = (
          <DemoApp
            key={activeProject.configVersion}
            server={activeProject.server}
            forcePathSubscribe={listener => this.forcePathListener = listener}
          />
        );
        break;
    }

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

    return (
      <Elements stripe={stripePromise}>
        {this.props.account && (
          <SubscriptionStatusNotifier account={this.props.account} />
        )}
        <Layout
          toolbarLeft={
            <div className={this.props.classes.toolbarLeft}>
              <Typography variant='h6' color="inherit" noWrap>
                Dashboard
              </Typography>
              <SelectionPicker
                className={this.props.classes.projectPicker}
                value={[selectedLabel]}
                disabled={activePath === 'create'}
                overrideComponents={{DropdownIndicator: null}}
                options={projectOptions}
                inputMinWidth='75px'
                isMulti={false}
                bare={false}
                onValueChange={(labels, action) => {
                  if (labels.length === 1) {
                    if(labels[0].value === '__CREATE__') {
                      this.pageClicked('create');
                    } else {
                      this.setState({ selectedProjectLabel: labels[0] });
                    }
                  }
                }}
              />
            </div>
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
          preview={preview}
          menu={(
            <Menu
              items={[
                { type: 'item', slug: '', name: 'Home' } as MenuItem,
                { type: 'heading', text: 'Explore' } as MenuHeading,
                { type: 'item', slug: 'posts', name: 'Posts', offset: 1 } as MenuItem,
                // { type: 'item', slug: 'comments', name: 'Comments', offset: 1 } as MenuItem,
                { type: 'item', slug: 'users', name: 'Users', offset: 1 } as MenuItem,
                { type: 'item', slug: 'moderators', name: 'Moderators', offset: 1 } as MenuItem,
                activeProject ? {
                  type: 'project',
                  name: 'Settings',
                  projectId: activeProject.server.getProjectId(),
                  page: activeProject.editor.getPage([]),
                  hasUnsavedChanges: activeProject.hasUnsavedChanges()
                } as MenuProject
                : { type: 'heading', text: 'Settings' } as MenuHeading,
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
          <Crumbs
            crumbs={crumbs}
            activeProject={activeProject}
            activeSubPath={activeSubPath}
            pageClicked={this.pageClicked.bind(this)}
          />
          {page}
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
}, null, null, { forwardRef: true })(withStyles(styles, { withTheme: true })(Dashboard));
