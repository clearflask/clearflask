import { Button, Collapse, Typography } from '@material-ui/core';
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
import PostPage from '../app/comps/PostPage';
import SelectionPicker, { Label } from '../app/comps/SelectionPicker';
import UserPage from '../app/comps/UserPage';
import ErrorPage from '../app/ErrorPage';
import LoadingPage from '../app/LoadingPage';
import DividerCorner from '../app/utils/DividerCorner';
import SubscriptionStatusNotifier from '../app/utils/SubscriptionStatusNotifier';
import * as ConfigEditor from '../common/config/configEditor';
import ConfigView from '../common/config/settings/ConfigView';
import Crumbs from '../common/config/settings/Crumbs';
import Menu, { MenuItem, MenuProject } from '../common/config/settings/Menu';
import Page from '../common/config/settings/Page';
import ProjectSettings from '../common/config/settings/ProjectSettings';
import Layout from '../common/Layout';
import UserDisplayMe from '../common/UserDisplayMe';
import notEmpty from '../common/util/arrayUtil';
import debounce, { SearchTypeDebounceTime } from '../common/util/debounce';
import { isProd } from '../common/util/detectEnv';
import { withMediaQuery, WithMediaQuery } from '../common/util/MediaQuery';
import setTitle from '../common/util/titleUtil';
import ContactPage from './ContactPage';
import BillingPage, { BillingPaymentActionRedirect, BillingPaymentActionRedirectPath } from './dashboard/BillingPage';
import CommentsPage from './dashboard/CommentsPage';
import CreatedPage from './dashboard/CreatedPage';
import CreatePage from './dashboard/CreatePage';
import DashboardHome from './dashboard/DashboardHome';
import SettingsPage from './dashboard/SettingsPage';
import UserSelection from './dashboard/UserSelection';
import UsersPage from './dashboard/UsersPage';
import WelcomePage from './dashboard/WelcomePage';
import DemoApp, { getProject, Project } from './DemoApp';

const SELECTED_PROJECT_ID_LOCALSTORAGE_KEY = 'dashboard-selected-project-id';
/** If changed, also change in ClearFlaskCreditSync.java */
const ClearFlaskProjectId = 'clearflask';

loadStripe.setLoadParameters({ advancedFraudSignals: false })
const stripePromise = loadStripe(isProd()
  ? 'pk_live_6HJ7aPzGuVyPwTX5ngwAw0Gh'
  : 'pk_test_M1ANiFgYLBV2UyeVB10w1Ons');

const styles = (theme: Theme) => createStyles({
  toolbarLeft: {
    display: 'flex',
    alignItems: 'center',
  },
  projectUserSelectorsHeader: {
    display: 'flex',
    flexWrap: 'wrap',
    height: 64,
    alignItems: 'flex-end',
    marginBottom: -1,
  },
  projectUserSelectorHeader: {
    margin: theme.spacing(1, 1, 0),
  },
  projectUserSelectorMenu: {
    margin: theme.spacing(2),
  },
  selectProjectLabel: {
    color: theme.palette.text.secondary,
  },
  previewBarText: {
    display: 'flex',
    alignItems: 'baseline',
  },
});

interface Props {
  forceMock?: boolean;
}
interface ConnectProps {
  accountStatus?: Status;
  account?: AdminClient.AccountAdmin;
  isSuperAdmin: boolean;
  configsStatus?: Status;
  bindByProjectId?: { [projectId: string]: AdminClient.ConfigAndBindAllResultByProjectId };
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
  accountSearch?: AdminClient.Account[];
  accountSearching?: string;
}
class Dashboard extends Component<Props & ConnectProps & RouteComponentProps & WithStyles<typeof styles, true> & WithMediaQuery, State> {
  unsubscribes: { [projectId: string]: () => void } = {};
  createProjectPromise: Promise<Project> | undefined = undefined;
  createProject: Project | undefined = undefined;
  forcePathListener: ((forcePath: string) => void) | undefined;
  readonly searchAccounts: (newValue: string) => void;

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
            if (result.account) d.configGetAllAndUserBindAllAdmin()
          }))
        .catch(e => this.setState({ binding: false }));
    } else if (props.accountStatus === Status.FULFILLED && !props.configsStatus) {
      this.state = {
        currentPagePath: [],
      };
      ServerAdmin.get(props.forceMock).dispatchAdmin().then(d => d.configGetAllAndUserBindAllAdmin());
    } else {
      this.state = {
        currentPagePath: [],
      };
    }
    const searchAccountsDebounced = debounce(
      (newValue: string) => ServerAdmin.get().dispatchAdmin().then(d => d.accountSearchSuperAdmin({
        accountSearchSuperAdmin: {
          searchText: newValue,
        },
      })).then(result => this.setState({
        accountSearch: result.results,
        ...(this.state.accountSearching === newValue ? { accountSearching: undefined } : {}),
      })).catch(e => {
        if (this.state.accountSearching === newValue) this.setState({ accountSearching: undefined });
      })
      , SearchTypeDebounceTime);
    this.searchAccounts = newValue => {
      this.setState({ accountSearching: newValue });
      searchAccountsDebounced(newValue);
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
    } else if (this.props.configsStatus !== Status.FULFILLED || !this.props.bindByProjectId || !this.props.account) {
      return (<LoadingPage />);
    }
    const activePath = this.props.match.params['path'] || '';
    if (activePath === BillingPaymentActionRedirectPath) {
      return (
        <BillingPaymentActionRedirect />
      );
    }
    const activeSubPath = ConfigEditor.parsePath(this.props.match.params['subPath'], '/');
    const projects = Object.keys(this.props.bindByProjectId)
      .map(projectId => ServerAdmin.get(this.props.forceMock)
        .getOrCreateProject(this.props.bindByProjectId![projectId].config,
          this.props.bindByProjectId![projectId].user));
    projects.forEach(project => {
      if (!this.unsubscribes[project.projectId]) {
        this.unsubscribes[project.projectId] = project.subscribeToUnsavedChanges(() => {
          this.forceUpdate();
        });
      }
    });

    const projectOptions: Label[] = projects.map(p => ({
      label: p.editor.getConfig().name,
      filterString: p.editor.getConfig().name,
      value: p.projectId
    }));
    var selectedLabel: Label | undefined = this.state.selectedProjectId ? projectOptions.find(o => o.value === this.state.selectedProjectId) : undefined;
    if (!selectedLabel) {
      const selectedProjectIdFromLocalStorage = localStorage.getItem(SELECTED_PROJECT_ID_LOCALSTORAGE_KEY);
      selectedLabel = projectOptions.find(o => o.value === selectedProjectIdFromLocalStorage);
    }
    if (activePath === 'create') {
      selectedLabel = undefined;
    } else if (!selectedLabel && projects.length > 0) {
      selectedLabel = { label: projects[0].editor.getConfig().name, value: projects[0].projectId };
    }
    const activeProjectId: string | undefined = selectedLabel?.value;
    const activeProject = projects.find(p => p.projectId === activeProjectId);

    var page;
    var preview;
    var previewBar;
    var previewBarInfo;
    var crumbs: { name: string, slug: string }[] | undefined;
    var allowProjectUserSelect: boolean = false;
    var showCreateProjectWarning: boolean = false;
    switch (activePath) {
      case '':
        setTitle('Home - Dashboard');
        allowProjectUserSelect = true;
        if (!activeProject) {
          showCreateProjectWarning = true;
          break;
        }
        page = (
          <Provider key={activeProject.projectId} store={activeProject.server.getStore()}>
            <DashboardHome
              server={activeProject.server}
              onClickPost={postId => this.pageClicked('post', [postId])}
              onUserClick={userId => this.pageClicked('user', [userId])}
            />
          </Provider>
        );
        crumbs = [{ name: 'Home', slug: activePath }];
        break;
      case 'welcome':
        setTitle('Welcome - Dashboard');
        page = (
          <WelcomePage />
        );
        crumbs = [{ name: 'Welcome', slug: activePath }];
        break;
      case 'created':
        setTitle('Success - Dashboard');
        if (!activeProject) {
          showCreateProjectWarning = true;
          break;
        }
        page = (
          <Provider key={activeProject.projectId} store={activeProject.server.getStore()}>
            <CreatedPage key={activeProject.server.getProjectId()} server={activeProject.server} />
          </Provider>
        );
        crumbs = [{ name: 'Project Created', slug: activePath }];
        break;
      case 'posts':
        setTitle('Posts - Dashboard');
        allowProjectUserSelect = true;
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
        allowProjectUserSelect = true;
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
        allowProjectUserSelect = true;
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
        allowProjectUserSelect = true;
        if (!activeProject) {
          showCreateProjectWarning = true;
          break;
        }
        page = (
          <Provider key={activeProject.projectId} store={activeProject.server.getStore()}>
            <CommentsPage
              server={activeProject.server}
              onCommentClick={(postId, commentId) => this.pageClicked('post', [postId])}
              onUserClick={userId => this.pageClicked('user', [userId])}
            />
          </Provider>
        );
        crumbs = [{ name: 'Comments', slug: activePath }];
        break;
      case 'users':
        setTitle('Users - Dashboard');
        allowProjectUserSelect = true;
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
        page = (<BillingPage stripePromise={stripePromise} />);
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
          this.createProjectPromise = getProject(undefined, undefined, { suppressSetTitle: true });
          this.createProjectPromise.then(project => {
            this.createProject = project;
            this.forceUpdate();
          })
        }
        page = this.createProject && (
          <CreatePage
            previewProject={this.createProject}
            projectCreated={(projectId) => {
              localStorage.setItem(SELECTED_PROJECT_ID_LOCALSTORAGE_KEY, projectId);
              this.pageClicked('created');
              this.setState({ selectedProjectId: projectId });
            }}
          />
        );
        crumbs = [{ name: 'Create', slug: activePath }];
        previewBarInfo = this.createProject && 'Project preview with sample data.';
        preview = this.createProject && (
          <DemoApp
            key={this.createProject.server.getStore().getState().conf.ver || 'preview-create-project'}
            server={this.createProject.server}
          />
        );
        break;
      case 'settings':
        allowProjectUserSelect = true;
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
        previewBarInfo = (
          <div className={this.props.classes.previewBarText}>
            Preview changes live as&nbsp;
            <Provider key={activeProject.projectId} store={activeProject.server.getStore()}>
              <UserDisplayMe variant='text' />
            </Provider>
          </div>
        );
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
      this.props.history.push('/dashboard/welcome');
    }

    const quickViewEnabled = this.isQuickViewEnabled();
    if (quickViewEnabled && activeProject) {
      switch (this.state.quickView?.type) {
        case 'post':
          const postId = this.state.quickView.id;
          previewBarInfo = (
            <div className={this.props.classes.previewBarText}>
              Viewing post as&nbsp;
              <Provider key={activeProject.projectId} store={activeProject.server.getStore()}>
                <UserDisplayMe variant='text' />
              </Provider>
            </div>
          );
          preview = (
            <Provider key={activeProject.projectId} store={activeProject.server.getStore()}>
              <PostPage key={postId} server={activeProject.server} postId={postId}
                suppressSimilar
                PostProps={{
                  onUserClick: userId => this.pageClicked('user', [userId]),
                }} />
            </Provider>
          );
          break;
        case 'user':
          const userId = this.state.quickView.id;
          previewBarInfo = (
            <div className={this.props.classes.previewBarText}>
              Viewing user profile as&nbsp;
              <Provider key={activeProject.projectId} store={activeProject.server.getStore()}>
                <UserDisplayMe variant='text' />
              </Provider>
            </div>
          );
          preview = (
            <Provider key={activeProject.projectId} store={activeProject.server.getStore()}>
              <UserPage key={userId} server={activeProject.server} userId={userId} />
            </Provider>
          );
          break;
      }
    }

    var billingHasNotification: boolean = false;
    switch (this.props.account.subscriptionStatus) {
      case AdminClient.SubscriptionStatus.ActivePaymentRetry:
      case AdminClient.SubscriptionStatus.ActiveNoRenewal:
      case AdminClient.SubscriptionStatus.NoPaymentMethod:
      case AdminClient.SubscriptionStatus.Blocked:
      case AdminClient.SubscriptionStatus.Cancelled:
        billingHasNotification = true;
        break;
      default:
      case AdminClient.SubscriptionStatus.ActiveTrial:
      case AdminClient.SubscriptionStatus.Active:
        break;
    }

    const seenAccountEmails: Set<string> = new Set();
    const curAccountLabel: Label = Dashboard.accountToLabel(this.props.account);
    const accountOptions = [curAccountLabel];
    seenAccountEmails.add(this.props.account.email)
    this.state.accountSearch && this.state.accountSearch.forEach(account => {
      if (!seenAccountEmails.has(account.email)) {
        const label = Dashboard.accountToLabel(account);
        seenAccountEmails.add(account.email);
        accountOptions.push(label);
      }
    });

    const isSelectProjectUserInMenu = !quickViewEnabled;
    const selectProjectUser = (
      <div className={isSelectProjectUserInMenu ? undefined : this.props.classes.projectUserSelectorsHeader}>
        {!!this.props.isSuperAdmin && (
          <SelectionPicker
            disableClearable
            className={isSelectProjectUserInMenu ? this.props.classes.projectUserSelectorMenu : this.props.classes.projectUserSelectorHeader}
            value={[curAccountLabel]}
            forceDropdownIcon={false}
            options={accountOptions}
            helperText={isSelectProjectUserInMenu && 'Current account' || undefined}
            minWidth={50}
            maxWidth={150}
            inputMinWidth={0}
            showTags
            bareTags
            disableFilter
            loading={this.state.accountSearching !== undefined}
            noOptionsMessage='No accounts'
            onFocus={() => {
              if (this.state.accountSearch === undefined
                && this.state.accountSearching === undefined) {
                this.searchAccounts('');
              }
            }}
            onInputChange={(newValue, reason) => {
              if (reason === 'input') {
                this.searchAccounts(newValue);
              }
            }}
            onValueChange={labels => {
              const email = labels[0]?.value;
              if (email && this.props.account?.email !== email) {
                this.setState({
                  binding: true,
                  quickView: undefined,
                });
                ServerAdmin.get().dispatchAdmin().then(d => d.accountLoginAsSuperAdmin({
                  accountLoginAs: {
                    email,
                  },
                })
                  .then(result => {
                    this.setState({ binding: false })
                    return d.configGetAllAndUserBindAllAdmin();
                  }))
                  .catch(e => this.setState({ binding: false }));
              }
            }}
          />
        )}
        {projects.length > 1 && (
          <Collapse in={!!allowProjectUserSelect}>
            <SelectionPicker
              disableClearable
              className={isSelectProjectUserInMenu ? this.props.classes.projectUserSelectorMenu : this.props.classes.projectUserSelectorHeader}
              value={selectedLabel ? [selectedLabel] : []}
              forceDropdownIcon={false}
              options={projectOptions}
              helperText={isSelectProjectUserInMenu && 'Current project' || undefined}
              showTags
              bareTags
              disableInput
              minWidth={50}
              maxWidth={150}
              clearOnBlur
              onValueChange={labels => {
                const selectedProjectId = labels[0]?.value;
                if (selectedProjectId && this.state.selectedProjectId !== selectedProjectId) {
                  localStorage.setItem(SELECTED_PROJECT_ID_LOCALSTORAGE_KEY, selectedProjectId);
                  this.setState({
                    selectedProjectId,
                    quickView: undefined,
                  });
                }
              }}
            />
          </Collapse>
        )}
        <Collapse in={!!allowProjectUserSelect}>
          {activeProject && (
            <Provider key={activeProject.projectId} store={activeProject.server.getStore()}>
              <UserSelection
                className={isSelectProjectUserInMenu ? this.props.classes.projectUserSelectorMenu : this.props.classes.projectUserSelectorHeader}
                server={activeProject.server}
                allowCreate
                allowClear
                alwaysOverrideWithLoggedInUser
                helperText={isSelectProjectUserInMenu && 'Current user' || undefined}
                placeholder='Anonymous'
                minWidth={50}
                maxWidth={150}
                onChange={userLabel => {
                  if (activeProject) {
                    const projectId = activeProject.projectId
                    if (userLabel) {
                      activeProject.server.dispatchAdmin().then(d => d.userLoginAdmin({
                        projectId,
                        userId: userLabel.value,
                      })).then(userMe => this.setState({
                        quickView: {
                          id: userMe.userId,
                          type: 'user',
                        },
                      }));
                    } else {
                      if (this.state.quickView?.type === 'user'
                        && this.state.quickView.id === activeProject.server.getStore().getState().users.loggedIn.user?.userId) {
                        this.setState({ quickView: undefined });
                      }
                      activeProject.server.dispatch().userLogout({
                        projectId,
                      });
                    }
                  }
                }}
              />
            </Provider>
          )}
        </Collapse>
      </div>
    );

    return (
      <Elements stripe={stripePromise}>
        {this.props.account && (
          <SubscriptionStatusNotifier account={this.props.account} />
        )}
        <Layout
          toolbarLeft={
            <div className={this.props.classes.toolbarLeft}>
              <Typography
                style={{ width: !isSelectProjectUserInMenu ? 180 : undefined }}
                variant='h6'
                color="inherit"
                noWrap
                onClick={() => this.setState({ titleClicked: (this.state.titleClicked || 0) + 1 })}
              >
                Dashboard
              </Typography>
              {!isSelectProjectUserInMenu && selectProjectUser}
            </div>
          }
          previewBar={previewBar}
          previewBarInfo={previewBarInfo}
          preview={preview}
          menu={(
            <div>
              {isSelectProjectUserInMenu && selectProjectUser}
              <Menu
                items={[
                  { type: 'item', slug: '', name: 'Home' } as MenuItem,
                  { type: 'item', slug: 'posts', name: 'Posts', offset: 1 } as MenuItem,
                  { type: 'item', slug: 'users', name: 'Users', offset: 1 } as MenuItem,
                  { type: 'item', slug: 'comments', name: 'Comments', offset: 1 } as MenuItem,
                  activeProject ? {
                    type: 'project',
                    name: 'Project Settings',
                    slug: 'settings',
                    projectId: activeProject.server.getProjectId(),
                    page: activeProject.editor.getPage([]),
                    hasUnsavedChanges: activeProject.hasUnsavedChanges()
                  } as MenuProject
                    : { type: 'item', slug: 'settings', name: 'Project Settings' } as MenuItem,
                  { type: 'item', slug: 'create', name: 'New project' } as MenuItem,
                  { type: 'item', slug: 'account', name: 'Account' } as MenuItem,
                  { type: 'item', slug: 'billing', name: 'Billing', hasNotification: billingHasNotification, offset: 1 } as MenuItem,
                  { type: 'item', slug: 'help', name: 'Help' } as MenuItem,
                  { type: 'item', name: 'Docs', offset: 1, ext: this.openFeedbackUrl('docs') } as MenuItem,
                  { type: 'item', name: 'Roadmap', offset: 1, ext: this.openFeedbackUrl('roadmap') } as MenuItem,
                  { type: 'item', name: 'Feedback', offset: 1, ext: this.openFeedbackUrl('feedback') } as MenuItem,
                ].filter(notEmpty)}
                onAnyClick={() => this.setState({ quickView: undefined })}
                activePath={activePath}
                activeSubPath={activeSubPath}
              />
            </div>
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
          {activeProject && (this.state.titleClicked || 0) >= 10 && (
            <DividerCorner title='Configuration dump'>
              <ConfigView editor={activeProject.editor} />
            </DividerCorner>
          )}
        </Layout>
      </Elements>
    );
  }

  openFeedbackUrl(page?: string) {
    return `${window.location.protocol}//${ClearFlaskProjectId}.${window.location.host}/${page || ''}?${SSO_TOKEN_PARAM_NAME}=${this.props.account?.cfJwt}`;
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
    return this.props.mediaQuery;
  }

  static accountToLabel(account: AdminClient.Account): Label {
    return {
      label: account.name,
      filterString: `${account.name} ${account.email}`,
      value: account.email
    };
  }
}

export default connect<ConnectProps, {}, Props, ReduxStateAdmin>((state, ownProps) => {
  const connectProps: ConnectProps = {
    accountStatus: state.account.account.status,
    account: state.account.account.account,
    isSuperAdmin: state.account.isSuperAdmin,
    configsStatus: state.configs.configs.status,
    bindByProjectId: state.configs.configs.byProjectId,
  };
  return connectProps;
}, null, null, { forwardRef: true })(withStyles(styles, { withTheme: true })(withMediaQuery(theme => theme.breakpoints.up('md'))(Dashboard)));
