import { Button, Fade, IconButton, isWidthUp, Typography, withWidth, WithWidthProps } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js/pure';
import React, { Component } from 'react';
import { connect, Provider } from 'react-redux';
import { Redirect, Route, RouteComponentProps } from 'react-router';
import * as AdminClient from '../api/admin';
import { Status } from '../api/server';
import ServerAdmin, { ReduxStateAdmin } from '../api/serverAdmin';
import { SSO_TOKEN_PARAM_NAME } from '../app/App';
import IdeaExplorer from '../app/comps/IdeaExplorer';
import IdeaExplorerAdmin from '../app/comps/IdeaExplorerAdmin';
import PostPage from '../app/comps/PostPage';
import SelectionPicker, { Label } from '../app/comps/SelectionPicker';
import UserPage from '../app/comps/UserPage';
import ErrorPage from '../app/ErrorPage';
import LoadingPage from '../app/LoadingPage';
import DividerCorner from '../app/utils/DividerCorner';
import SubscriptionStatusNotifier from '../app/utils/SubscriptionStatusNotifier';
import AsUser from '../common/AsUser';
import * as ConfigEditor from '../common/config/configEditor';
import ConfigView from '../common/config/settings/ConfigView';
import Crumbs from '../common/config/settings/Crumbs';
import Menu, { MenuItem, MenuProject } from '../common/config/settings/Menu';
import Page from '../common/config/settings/Page';
import ProjectSettings from '../common/config/settings/ProjectSettings';
import LogoutIcon from '../common/icon/LogoutIcon';
import Layout from '../common/Layout';
import notEmpty from '../common/util/arrayUtil';
import { isProd } from '../common/util/detectEnv';
import setTitle from '../common/util/titleUtil';
import ContactPage from './ContactPage';
import BillingPage from './dashboard/BillingPage';
import CommentsPage from './dashboard/CommentsPage';
import CreatePage from './dashboard/CreatePage';
import SettingsPage from './dashboard/SettingsPage';
import UsersPage from './dashboard/UsersPage';
import DemoApp, { getProject, Project } from './DemoApp';

/** If changed, also change in ClearFlaskCreditSync.java */
const ClearFlaskProjectId = 'clearflask';

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
    color: theme.palette.text.secondary,
  },
  projectUserSelectors: {
    display: 'flex',
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
  selectedProjectId?: string;
  titleClicked?: number
  quickView?: {
    type: 'user' | 'post';
    id: string;
  }
}
class Dashboard extends Component<Props & ConnectProps & RouteComponentProps & WithStyles<typeof styles, true> & WithWidthProps, State> {
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

    const noProjectLabel = {
      label: (
        <span className={this.props.classes.selectProjectLabel}>
          Select project
        </span>
      ), value: '__NONE__'
    };
    const createLabel = {
      label: '+ Create', value: '__CREATE__'
    };
    const projectOptions = [
      ...(projects.length > 0
        ? projects.map(p => ({ label: p.editor.getConfig().name, value: p.projectId }))
        : [noProjectLabel]),
      createLabel,
    ];
    var selectedLabel: Label | undefined = this.state.selectedProjectId ? projectOptions.find(o => o.value === this.state.selectedProjectId) : undefined;
    var activeProjectId: string | undefined = selectedLabel?.value;
    if (activePath === 'create') {
      selectedLabel = createLabel;
    } else if (!selectedLabel && projects.length > 0) {
      selectedLabel = { label: projects[0].editor.getConfig().name, value: projects[0].projectId };
      activeProjectId = projects[0].projectId;
    } else if (!selectedLabel) {
      selectedLabel = noProjectLabel;
    }
    const activeProject = projects.find(p => p.projectId === activeProjectId);

    var page;
    var preview;
    var crumbs: { name: string, slug: string }[] | undefined;
    var showProjectSelect: boolean = false;
    var showCreateProjectWarning: boolean = false;
    switch (activePath) {
      case '':
        setTitle('Home - Dashboard');
        showProjectSelect = true;
        if (!activeProject) {
          showCreateProjectWarning = true;
          break;
        }
        page = (
          <Provider key={activeProject.projectId} store={activeProject.server.getStore()}>
            <IdeaExplorerAdmin server={activeProject.server} />
          </Provider>
        );
        crumbs = [{ name: 'Home', slug: activePath }];
        break;
      case 'posts':
        setTitle('Posts - Dashboard');
        showProjectSelect = true;
        if (!activeProject) {
          showCreateProjectWarning = true;
          break;
        }
        page = (
          <Provider key={activeProject.projectId} store={activeProject.server.getStore()}>
            <IdeaExplorer
              server={activeProject.server}
              forceDisablePostExpand
              onClickPost={postId => this.pageClicked('post', [postId])}
              explorer={{
                allowSearch: { enableSort: true, enableSearchText: true, enableSearchByCategory: true, enableSearchByStatus: true, enableSearchByTag: true },
                allowCreate: {},
                search: {},
                display: {},
              }}
            />
          </Provider>
        );
        crumbs = [{ name: 'Post', slug: activePath }];
        break;
      case 'post':
        // Page title set by PostPage
        showProjectSelect = true;
        if (!activeProject) {
          showCreateProjectWarning = true;
          break;
        }
        const postId = activeSubPath && activeSubPath[0] as string || '';
        page = (
          <Provider key={activeProject.projectId} store={activeProject.server.getStore()}>
            <PostPage key={postId} server={activeProject.server} postId={postId} />
          </Provider>
        );
        crumbs = [{ name: 'Posts', slug: 'posts' }];
        break;
      case 'user':
        // Page title set by UserPage
        showProjectSelect = true;
        if (!activeProject) {
          showCreateProjectWarning = true;
          break;
        }
        const userId = activeSubPath && activeSubPath[0] as string || '';
        page = (
          <Provider key={activeProject.projectId} store={activeProject.server.getStore()}>
            <UserPage key={userId} server={activeProject.server} userId={userId} />
          </Provider>
        );
        crumbs = [{ name: 'Users', slug: 'users' }];
        break;
      case 'comments':
        setTitle('Comments');
        showProjectSelect = true;
        if (!activeProject) {
          showCreateProjectWarning = true;
          break;
        }
        page = (
          <Provider key={activeProject.projectId} store={activeProject.server.getStore()}>
            <CommentsPage
              server={activeProject.server}
              onCommentClick={(postId, commentId) => this.pageClicked('post', [postId])}
            />
          </Provider>
        );
        crumbs = [{ name: 'Comments', slug: activePath }];
        break;
      case 'users':
        setTitle('Users - Dashboard');
        showProjectSelect = true;
        if (!activeProject) {
          showCreateProjectWarning = true;
          break;
        }
        page = (
          <Provider key={activeProject.projectId} store={activeProject.server.getStore()}>
            <UsersPage
              server={activeProject.server}
              onUserClick={userId => this.pageClicked('user', [userId])}
            />
          </Provider>
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
      case 'help':
        setTitle('Support - Dashboard');
        page = (
          <Route path={`/dashboard/help`} render={props => (
            <ContactPage {...props} />
          )} />
        );
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
            projectCreated={(projectId) => {
              this.setState({ selectedProjectId: projectId });
              this.pageClicked('settings');
            }}
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
      case 'settings':
        showProjectSelect = true;
        if (!activeProject) {
          setTitle('Settings - Dashboard');
          showCreateProjectWarning = true;
          break;
        }
        try {
          var currentPage = activeProject.editor.getPage(activeSubPath);
        } catch (ex) {
          setTitle('Settings - Dashboard');
          page = (
            <ErrorPage msg='Oops, page failed to load' />
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
      default:
        setTitle('Page not found');
        crumbs = [];
        page = (
          <ErrorPage msg='Oops, cannot find project' />
        );
        break;
    }
    if (showCreateProjectWarning) {
      page = (
        <ErrorPage msg='Oops, you have to create a project first' />
      );
    }

    const quickViewEnabled = this.isQuickViewEnabled();
    if (quickViewEnabled && activeProject) {
      switch (this.state.quickView?.type) {
        case 'post':
          const postId = this.state.quickView.id;
          preview = (
            <Provider key={activeProject.projectId} store={activeProject.server.getStore()}>
              <PostPage key={postId} server={activeProject.server} postId={postId} />
            </Provider>
          );
          break;
        case 'user':
          const userId = this.state.quickView.id;
          preview = (
            <Provider key={activeProject.projectId} store={activeProject.server.getStore()}>
              <UserPage key={userId} server={activeProject.server} userId={userId} />
            </Provider>
          );
          break;
      }
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
              <Typography
                variant='h6'
                color="inherit"
                noWrap
                onClick={() => this.setState({ titleClicked: (this.state.titleClicked || 0) + 1 })}
              >
                Dashboard
              </Typography>
              <Fade in={showProjectSelect}>
                <div className={this.props.classes.projectUserSelectors}>
                  <SelectionPicker
                    className={this.props.classes.projectPicker}
                    value={[selectedLabel]}
                    overrideComponents={{ DropdownIndicator: null }}
                    options={projectOptions}
                    inputMinWidth='100px'
                    isMulti={false}
                    bare={false}
                    onValueChange={(labels, action) => {
                      if (labels.length === 1) {
                        if (labels[0].value === '__CREATE__') {
                          this.pageClicked('create');
                        } else {
                          this.setState({ selectedProjectId: labels[0].value });
                        }
                      }
                    }}
                  />
                  {activeProject && (
                    <Provider key={activeProject.projectId} store={activeProject.server.getStore()}>
                      <AsUser key={activeProject.projectId} server={activeProject?.server} />
                    </Provider>
                  )}
                </div>
              </Fade>
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
                { type: 'item', slug: 'posts', name: 'Posts', offset: 1 } as MenuItem,
                { type: 'item', slug: 'comments', name: 'Comments', offset: 1 } as MenuItem,
                { type: 'item', slug: 'users', name: 'Users', offset: 1 } as MenuItem,
                activeProject ? {
                  type: 'project',
                  name: 'Settings',
                  slug: 'settings',
                  projectId: activeProject.server.getProjectId(),
                  page: activeProject.editor.getPage([]),
                  hasUnsavedChanges: activeProject.hasUnsavedChanges()
                } as MenuProject
                  : { type: 'item', slug: 'settings', name: 'Settings' } as MenuItem,
                { type: 'item', slug: 'account', name: 'Account' } as MenuItem,
                { type: 'item', slug: 'billing', name: 'Billing', hasNotification: billingHasNotification, offset: 1 } as MenuItem,
                { type: 'item', slug: 'help', name: 'Help' } as MenuItem,
                { type: 'item', name: 'Docs', offset: 1, onClick: () => this.openFeedback('docs') } as MenuItem,
                { type: 'item', name: 'Roadmap', offset: 1, onClick: () => this.openFeedback('roadmap') } as MenuItem,
                { type: 'item', name: 'Feedback', offset: 1, onClick: () => this.openFeedback('feedback') } as MenuItem,
              ].filter(notEmpty)}
              activePath={activePath}
              activeSubPath={activeSubPath}
              pageClicked={this.pageClicked.bind(this)}
            />
          )}
          barBottom={(activePath === 'settings' && activeProject && activeProject.hasUnsavedChanges()) ? (
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
            activeProjectSlug='settings'
            activeProjectSlugName='Settings'
            activeProject={activeProject}
            activeSubPath={activeSubPath}
            pageClicked={this.pageClicked.bind(this)}
          />
          {page}
          {activeProject && (this.state.titleClicked || 0) >= 5 && (
            <DividerCorner title='Configuration dump'>
              <ConfigView editor={activeProject.editor} />
            </DividerCorner>
          )}
        </Layout>
      </Elements>
    );
  }

  openFeedback(page?: string) {
    window.open(`${window.location.protocol}//${ClearFlaskProjectId}.${window.location.host}/${page || ''}?${SSO_TOKEN_PARAM_NAME}=${this.props.account?.cfJwt}`, '_blank')
  }

  pageClicked(path: string, subPath: ConfigEditor.Path = []): void {
    const quickViewEnabled = this.isQuickViewEnabled();
    if (quickViewEnabled && (path === 'post' || path === 'user') && subPath[0]) {
      this.setState({
        quickView: {
          type: path,
          id: subPath[0] + '',
        }
      });
    } else {
      if (this.state.quickView) {
        this.setState({ quickView: undefined });
      }
      this.props.history.push(`/dashboard/${[path, ...subPath].join('/')}`);
    }
  }

  isQuickViewEnabled() {
    return this.props.width && isWidthUp('md', this.props.width, true);
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
}, null, null, { forwardRef: true })(withStyles(styles, { withTheme: true })(withWidth()(Dashboard)));
