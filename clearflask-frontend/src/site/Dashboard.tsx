import { Button, isWidthUp, Tab, Tabs, Typography, withWidth, WithWidthProps } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import AddIcon from '@material-ui/icons/Add';
import EmptyIcon from '@material-ui/icons/BlurOn';
import SettingsIcon from '@material-ui/icons/Settings';
import { Elements } from '@stripe/react-stripe-js';
import { Stripe } from '@stripe/stripe-js';
import { loadStripe } from '@stripe/stripe-js/pure';
import React, { Component } from 'react';
import { connect, Provider } from 'react-redux';
import { Redirect, RouteComponentProps } from 'react-router';
import { Link } from 'react-router-dom';
import * as AdminClient from '../api/admin';
import { Status } from '../api/server';
import ServerAdmin, { Project as AdminProject, ReduxStateAdmin } from '../api/serverAdmin';
import { SSO_TOKEN_PARAM_NAME } from '../app/App';
import SelectionPicker, { Label } from '../app/comps/SelectionPicker';
import UserPage from '../app/comps/UserPage';
import ErrorPage from '../app/ErrorPage';
import LoadingPage from '../app/LoadingPage';
import SubscriptionStatusNotifier from '../app/utils/SubscriptionStatusNotifier';
import * as ConfigEditor from '../common/config/configEditor';
import Menu, { MenuHeading, MenuItem, MenuProject } from '../common/config/settings/Menu';
import Page from '../common/config/settings/Page';
import { Orientation } from '../common/ContentScroll';
import { tabHoverApplyStyles } from '../common/DropdownTab';
import LogoutIcon from '../common/icon/LogoutIcon';
import VisitIcon from '../common/icon/VisitIcon';
import Layout, { Header, LayoutSize, PreviewSection, Section } from '../common/Layout';
import { MenuItems } from '../common/menus';
import UserFilterControls from '../common/search/UserFilterControls';
import debounce, { SearchTypeDebounceTime } from '../common/util/debounce';
import { detectEnv, Environment, isProd } from '../common/util/detectEnv';
import { RedirectIso, redirectIso } from '../common/util/routerUtil';
import { initialWidth } from '../common/util/screenUtil';
import setTitle from '../common/util/titleUtil';
import windowIso from '../common/windowIso';
import BillingPage, { BillingPaymentActionRedirect, BillingPaymentActionRedirectPath } from './dashboard/BillingPage';
import CreatedPage from './dashboard/CreatedPage';
import CreatePage from './dashboard/CreatePage';
import DashboardHome from './dashboard/DashboardHome';
import DashboardPost from './dashboard/DashboardPost';
import DashboardPostFilterControls from './dashboard/DashboardPostFilterControls';
import DashboardSearchControls from './dashboard/DashboardSearchControls';
import PostList from './dashboard/PostList';
import { ProjectSettingsBase, ProjectSettingsBranding, ProjectSettingsChangelog, ProjectSettingsData, ProjectSettingsDomain, ProjectSettingsFeedback, ProjectSettingsInstall, ProjectSettingsLanding, ProjectSettingsRoadmap, ProjectSettingsUsers } from './dashboard/ProjectSettings';
import RoadmapExplorer from './dashboard/RoadmapExplorer';
import SettingsPage from './dashboard/SettingsPage';
import UserList from './dashboard/UserList';
import UserSelection from './dashboard/UserSelection';
import WelcomePage from './dashboard/WelcomePage';
import DemoApp, { getProject, Project as DemoProject } from './DemoApp';
import Logo from './Logo';

const SELECTED_PROJECT_ID_LOCALSTORAGE_KEY = 'dashboard-selected-project-id';
const SELECTED_PROJECT_ID_PARAM_NAME = 'projectId';
type PreviewType = 'user' | 'post' | 'post-create' | 'create-demo' | 'preview-changes';
const PostPreviewSize: LayoutSize = { breakWidth: 600, flexGrow: 100, maxWidth: 1024 };
const UserPreviewSize: LayoutSize = { breakWidth: 350, flexGrow: 100, maxWidth: 1024 };
const ProjectPreviewSize: LayoutSize = { breakWidth: 500, flexGrow: 100, maxWidth: 1024 };
const ProjectSettingsMainSize: LayoutSize = { breakWidth: 500, flexGrow: 100, maxWidth: 1024, scroll: Orientation.Both };

const styles = (theme: Theme) => createStyles({
  toolbarLeft: {
    display: 'flex',
    alignItems: 'center',
    alignSelf: 'stretch',
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
  projectUserSelectorInline: {
  },
  projectUserSelectorInlineInputRoot: {
    fontSize: 'inherit',
  },
  selectProjectLabel: {
    color: theme.palette.text.secondary,
  },
  previewBarText: {
    display: 'flex',
    alignItems: 'center',
  },
  previewEmptyMessage: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.palette.text.hint,
  },
  previewEmptyIcon: {
    fontSize: '3em',
    margin: theme.spacing(3),
  },
  heading: {
    margin: theme.spacing(3, 3, 0),
  },
  logoLink: {
    cursor: 'pointer',
    textDecoration: 'none',
    textTransform: 'unset',
    margin: theme.spacing(1, 3, 1, 0),
  },
  tabs: {
    alignSelf: 'stretch',
    marginBottom: -1,
  },
  tabsIndicator: {
    borderRadius: '1px',
  },
  tabsFlexContainer: {
    height: '100%',
  },
  tab: {
    textTransform: 'initial',
  },
  tabRoot: {
    minWidth: '0px!important',
    padding: '6px 12px',
    [theme.breakpoints.up('md')]: {
      padding: '6px 24px',
    },
    ...(tabHoverApplyStyles(theme)),
  },
  accountSwitcher: {
    margin: theme.spacing(4, 'auto', 0),
  },
  unsavedChangesBar: {
    display: 'flex',
    alignItems: 'center',
    margin: theme.spacing(1, 2),
  },
});
interface Props {
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
  accountSearch?: AdminClient.Account[];
  accountSearching?: string;
  previewShow?: boolean;
  preview?: {
    type: PreviewType,
    id?: string,
  };
  // Below is state for individual pages
  // It's not very nice to be here in one place, but it does allow for state
  // to persist between page clicks
  explorerPostFilter?: Partial<AdminClient.IdeaSearchAdmin>;
  explorerPostSearch?: string;
  explorerPreview?: { type: 'create' } | { type: 'post', id: string },
  usersUserFilter?: Partial<AdminClient.UserSearchAdmin>;
  usersUserSearch?: string;
  usersPreview?: { type: 'create' } | { type: 'user', id: string },
}
class Dashboard extends Component<Props & ConnectProps & RouteComponentProps & WithStyles<typeof styles, true> & WithWidthProps, State> {
  static stripePromise: Promise<Stripe | null> | undefined;
  unsubscribes: { [projectId: string]: () => void } = {};
  createProjectPromise: Promise<DemoProject> | undefined = undefined;
  createProject: DemoProject | undefined = undefined;
  forcePathListener: ((forcePath: string) => void) | undefined;
  readonly searchAccounts: (newValue: string) => void;

  constructor(props) {
    super(props);

    Dashboard.getStripePromise();

    if (props.accountStatus === undefined) {
      this.state = {
        currentPagePath: [],
        binding: true,
      };
      this.bind();
    } else if (props.accountStatus === Status.FULFILLED && !props.configsStatus) {
      this.state = {
        currentPagePath: [],
      };
      ServerAdmin.get().dispatchAdmin().then(d => d.configGetAllAndUserBindAllAdmin());
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

  static getStripePromise(): Promise<Stripe | null> {
    if (!Dashboard.stripePromise) {
      try {
        loadStripe.setLoadParameters({ advancedFraudSignals: false });
      } catch (e) {
        // Frontend reloads in-place and causes stripe to be loaded multiple times
        if (detectEnv() !== Environment.DEVELOPMENT_FRONTEND) {
          throw e;
        }
      };
      Dashboard.stripePromise = loadStripe(isProd()
        ? 'pk_live_6HJ7aPzGuVyPwTX5ngwAw0Gh'
        : 'pk_test_M1ANiFgYLBV2UyeVB10w1Ons');
    }
    return Dashboard.stripePromise;
  }

  async bind() {
    try {
      if (detectEnv() === Environment.DEVELOPMENT_FRONTEND) {
        const mocker = await import(/* webpackChunkName: "mocker" */'../mocker')
        await mocker.mock();
      }
      const dispatcher = await ServerAdmin.get().dispatchAdmin();
      const result = await dispatcher.accountBindAdmin({});
      this.setState({ binding: false })
      if (result.account) {
        dispatcher.configGetAllAndUserBindAllAdmin();
      }
    } catch (er) {
      this.setState({ binding: false });
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
      .map(projectId => ServerAdmin.get()
        .getOrCreateProject(this.props.bindByProjectId![projectId].config,
          this.props.bindByProjectId![projectId].user));
    projects.forEach(project => {
      if (!this.unsubscribes[project.projectId]) {
        this.unsubscribes[project.projectId] = project.subscribeToUnsavedChanges(() => {
          this.forceUpdate();
        });
      }
    });

    const explorerWidth = (this.props.width && isWidthUp('lg', this.props.width, true)) ? 650 : 500;

    const projectOptions: Label[] = projects.map(p => ({
      label: p.editor.getConfig().name,
      filterString: p.editor.getConfig().name,
      value: p.projectId
    }));
    var selectedLabel: Label | undefined = this.state.selectedProjectId ? projectOptions.find(o => o.value === this.state.selectedProjectId) : undefined;
    if (!selectedLabel) {
      const params = new URL(windowIso.location.href).searchParams;
      const selectedProjectIdFromParams = params.get(SELECTED_PROJECT_ID_PARAM_NAME);
      if (selectedProjectIdFromParams) {
        selectedLabel = projectOptions.find(o => o.value === selectedProjectIdFromParams);
      }
    }
    if (!selectedLabel) {
      const selectedProjectIdFromLocalStorage = localStorage.getItem(SELECTED_PROJECT_ID_LOCALSTORAGE_KEY);
      if (selectedProjectIdFromLocalStorage) {
        selectedLabel = projectOptions.find(o => o.value === selectedProjectIdFromLocalStorage);
      }
    }
    if (activePath === 'create') {
      selectedLabel = undefined;
    } else if (!selectedLabel && projects.length > 0) {
      selectedLabel = { label: projects[0].editor.getConfig().name, value: projects[0].projectId };
    }
    const activeProjectId: string | undefined = selectedLabel?.value;
    const activeProject = projects.find(p => p.projectId === activeProjectId);


    var header: Header | undefined;
    var main: Section | undefined;
    var barTop: React.ReactNode | undefined;
    var barBottom: React.ReactNode | undefined;
    var onboarding = false;
    var preview: PreviewSection | undefined;
    var menu: Section | undefined;
    var showProjectLink: boolean = false;
    var showCreateProjectWarning: boolean = false;
    var showContentMargins: boolean = false;
    switch (activePath) {
      case '':
        setTitle('Home - Dashboard');
        showProjectLink = true;
        if (!activeProject) {
          showCreateProjectWarning = true;
          break;
        }
        main = {
          size: { maxWidth: 1024 },
          content: (
            <Provider key={activeProject.projectId} store={activeProject.server.getStore()}>
              <DashboardHome
                server={activeProject.server}
                onClickPost={postId => this.pageClicked('post', [postId])}
                onUserClick={userId => this.pageClicked('user', [userId])}
              />
            </Provider>
          ),
        };
        break;
      case 'welcome':
        setTitle('Welcome - Dashboard');
        onboarding = true;
        main = {
          content: (
            <WelcomePage />
          ),
        };
        break;
      case 'created':
        setTitle('Success - Dashboard');
        if (!activeProject) {
          showCreateProjectWarning = true;
          break;
        }
        main = {
          content: (
            <Provider key={activeProject.projectId} store={activeProject.server.getStore()}>
              <CreatedPage key={activeProject.server.getProjectId()} server={activeProject.server} />
            </Provider>
          ),
        };
        break;
      case 'explorer':
        setTitle('Explorer - Dashboard');
        if (!activeProject) {
          showCreateProjectWarning = true;
          break;
        }
        header = {
          title: 'Explore',
          action: {
            label: 'Create',
            onClick: () => this.pageClicked('post'),
          },
        };
        menu = {
          size: { breakWidth: 200, flexGrow: 100, width: 'max-content', maxWidth: 'max-content' },
          content: (
            <Provider key={activeProject.projectId} store={activeProject.server.getStore()}>
              <DashboardPostFilterControls
                key={activeProject.server.getProjectId()}
                server={activeProject.server}
                search={this.state.explorerPostFilter}
                onSearchChanged={explorerPostFilter => this.setState({ explorerPostFilter })}
              />
            </Provider>
          ),
        };
        main = {
          size: { breakWidth: 350, flexGrow: 20, maxWidth: 1024 },
          content: (
            <Provider key={activeProject.projectId} store={activeProject.server.getStore()}>
              <PostList
                key={activeProject.server.getProjectId()}
                server={activeProject.server}
                search={{
                  ...this.state.explorerPostFilter,
                  searchText: this.state.explorerPostSearch,
                }}
                onClickPost={postId => this.pageClicked('post', [postId])}
                onUserClick={userId => this.pageClicked('user', [userId])}
                selectedPostId={this.state.explorerPreview?.type === 'post' ? this.state.explorerPreview.id : undefined}
              />
            </Provider>
          ),
        };
        barTop = (
          <DashboardSearchControls
            key={'post-search-bar' + activeProject.server.getProjectId()}
            searchText={this.state.explorerPostSearch}
            onSearchChanged={searchText => this.setState({ explorerPostSearch: searchText })}
          />
        );

        if (this.state.explorerPreview?.type === 'create') {
          preview = this.renderPreviewPostCreate(activeProject);
        } else if (this.state.explorerPreview?.type === 'post') {
          preview = this.renderPreviewPost(this.state.explorerPreview.id, activeProject);
        } else {
          preview = this.renderPreviewEmpty('No post selected', PostPreviewSize);
        }

        showProjectLink = true;
        break;
      case 'roadmap':
        setTitle('Roadmap - Dashboard');
        if (!activeProject) {
          showCreateProjectWarning = true;
          break;
        }
        main = {
          size: { breakWidth: 1000 },
          content: (
            <Provider key={activeProject.projectId} store={activeProject.server.getStore()}>
              <RoadmapExplorer key={activeProject.server.getProjectId()} server={activeProject.server} />
            </Provider>
          ),
        };

        showProjectLink = true;
        break;
      case 'users':
        setTitle('Users - Dashboard');
        if (!activeProject) {
          showCreateProjectWarning = true;
          break;
        }
        header = {
          title: 'Users',
          action: {
            label: 'Create',
            onClick: () => this.pageClicked('user'),
          },
        };
        menu = {
          size: { breakWidth: 200, flexGrow: 100, width: 'max-content', maxWidth: 'max-content' },
          content: (
            <Provider key={activeProject.projectId} store={activeProject.server.getStore()}>
              <UserFilterControls
                key={activeProject.server.getProjectId()}
                search={this.state.usersUserFilter}
                onSearchChanged={usersUserFilter => this.setState({ usersUserFilter })}
              />
            </Provider>
          ),
        };
        main = {
          size: { breakWidth: 250, flexGrow: 20, maxWidth: 250 },
          content: (
            <Provider key={activeProject.projectId} store={activeProject.server.getStore()}>
              <UserList
                server={activeProject.server}
                search={{
                  ...this.state.usersUserFilter,
                  searchText: this.state.usersUserSearch,
                }}
                selectedUserId={this.state.usersPreview?.type === 'user' ? this.state.usersPreview.id : undefined}
                onUserClick={userId => this.pageClicked('user', [userId])}
              />
            </Provider>
          ),
        };
        barTop = (
          <DashboardSearchControls
            key={'user-search-bar' + activeProject.server.getProjectId()}
            searchText={this.state.usersUserSearch}
            onSearchChanged={searchText => this.setState({ usersUserSearch: searchText })}
          />
        );

        if (this.state.usersPreview?.type === 'create') {
          preview = this.renderPreviewUserCreate(activeProject);
        } else if (this.state.usersPreview?.type === 'user') {
          preview = this.renderPreviewUser(this.state.usersPreview.id, activeProject)
        } else {
          preview = this.renderPreviewEmpty('No user selected', UserPreviewSize);
        }

        showProjectLink = true;
        break;
      case 'billing':
        main = { content: (<RedirectIso to='/dashboard/settings/account/billing' />) };
        break;
      case 'account':
        main = { content: (<RedirectIso to='/dashboard/settings/account/profile' />) };
        break;
      // @ts-ignore fall-through
      case 'welcome-create':
        onboarding = true;
      case 'create':
        setTitle('Create - Dashboard');
        if (!this.createProjectPromise) {
          this.createProjectPromise = getProject(undefined, undefined, { suppressSetTitle: true });
          this.createProjectPromise.then(project => {
            this.createProject = project;
            this.forceUpdate();
          })
        }
        main = {
          content: !!this.createProject && (
            <CreatePage
              previewProject={this.createProject}
              projectCreated={(projectId) => {
                localStorage.setItem(SELECTED_PROJECT_ID_LOCALSTORAGE_KEY, projectId);
                this.setState({ selectedProjectId: projectId }, () => {
                  this.pageClicked('created');
                });
              }}
            />
          ),
        };
        preview = this.renderPreviewCreateDemo();
        break;
      case 'settings':
        showProjectLink = true;
        if (!activeProject) {
          setTitle('Advanced - Dashboard');
          showCreateProjectWarning = true;
          break;
        }
        // Superadmin account switcher
        const accountToLabel = (account: AdminClient.Account): Label => {
          return {
            label: account.name,
            filterString: `${account.name} ${account.email}`,
            value: account.email
          };
        }
        const seenAccountEmails: Set<string> = new Set();
        const curAccountLabel: Label = accountToLabel(this.props.account);
        const accountOptions = [curAccountLabel];
        seenAccountEmails.add(this.props.account.email)
        this.state.accountSearch && this.state.accountSearch.forEach(account => {
          if (!seenAccountEmails.has(account.email)) {
            const label = accountToLabel(account);
            seenAccountEmails.add(account.email);
            accountOptions.push(label);
          }
        });
        menu = {
          size: { breakWidth: 200, width: 'max-content', maxWidth: 350 },
          content: (
            <>
              <Menu
                items={[
                  { type: 'heading', text: 'Account' } as MenuHeading,
                  { type: 'item', slug: 'settings/account/profile', name: 'Profile', offset: 1 } as MenuItem,
                  { type: 'item', slug: 'settings/account/billing', name: 'Billing', offset: 1 } as MenuItem,
                  { type: 'heading', text: 'Project', hasUnsavedChanges: activeProject.hasUnsavedChanges() } as MenuHeading,
                  { type: 'item', slug: 'settings/project/install', name: 'Install', offset: 1 } as MenuItem,
                  { type: 'item', slug: 'settings/project/branding', name: 'Branding', offset: 2 } as MenuItem,
                  { type: 'item', slug: 'settings/project/domain', name: 'Custom Domain', offset: 2 } as MenuItem,
                  { type: 'item', slug: 'settings/project/users', name: 'Users', offset: 1 } as MenuItem,
                  { type: 'item', slug: 'settings/project/landing', name: 'Landing', offset: 1 } as MenuItem,
                  { type: 'item', slug: 'settings/project/feedback', name: 'Feedback', offset: 1 } as MenuItem,
                  { type: 'item', slug: 'settings/project/roadmap', name: 'Roadmap', offset: 1 } as MenuItem,
                  { type: 'item', slug: 'settings/project/changelog', name: 'Changelog', offset: 1 } as MenuItem,
                  { type: 'item', slug: 'settings/project/data', name: 'Data', offset: 1 } as MenuItem,
                  {
                    type: 'project',
                    name: 'Advanced',
                    slug: 'settings/project/advanced',
                    offset: 1,
                    projectId: activeProject.server.getProjectId(),
                    page: activeProject.editor.getPage([]),
                  } as MenuProject,
                ]}
                activePath={activePath}
                activeSubPath={activeSubPath}
              />
              {!!this.props.isSuperAdmin && (
                <SelectionPicker
                  className={this.props.classes.accountSwitcher}
                  disableClearable
                  value={[curAccountLabel]}
                  forceDropdownIcon={false}
                  options={accountOptions}
                  helperText='Switch account'
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
                      ServerAdmin.get().dispatchAdmin().then(d => d.accountLoginAsSuperAdmin({
                        accountLoginAs: {
                          email,
                        },
                      }).then(result => {
                        return d.configGetAllAndUserBindAllAdmin();
                      }));
                    }
                  }}
                />
              )}
            </>
          ),
        };

        if (activeSubPath[0] === 'project' && activeSubPath[1] === 'advanced') {
          const pagePath = activeSubPath.slice(2);
          try {
            var currentPage = activeProject.editor.getPage(pagePath);
          } catch (ex) {
            setTitle('Settings - Dashboard');
            main = { content: (<ErrorPage msg='Oops, page failed to load' />) };
            break;
          }
          if (!!this.forcePathListener
            && pagePath.length >= 3
            && pagePath[0] === 'layout'
            && pagePath[1] === 'pages') {
            const pageIndex = pagePath[2];
            const forcePath = '/' + (activeProject.editor.getProperty(['layout', 'pages', pageIndex, 'slug']) as ConfigEditor.StringProperty).value;
            this.forcePathListener(forcePath);
          }
          setTitle(currentPage.getDynamicName());


          main = {
            size: ProjectSettingsMainSize,
            content: (
              <ProjectSettingsBase>
                <Page
                  key={currentPage.key}
                  page={currentPage}
                  editor={activeProject.editor}
                  pageClicked={path => this.pageClicked(activePath, path)}
                />
              </ProjectSettingsBase>
            )
          };
          preview = this.renderPreviewChangesDemo(activeProject);
        } else if (activeSubPath[0] === 'account') {
          switch (activeSubPath[1]) {
            case 'profile':
              setTitle('Account - Dashboard');
              main = {
                size: ProjectSettingsMainSize,
                content: (<SettingsPage />),
              };
              break;
            case 'billing':
              setTitle('Billing - Dashboard');
              main = {
                size: ProjectSettingsMainSize,
                content: (<BillingPage stripePromise={Dashboard.getStripePromise()} />),
              };
              break;
          }
        } else if (activeSubPath[0] === 'project') {
          switch (activeSubPath[1]) {
            case 'install':
              main = {
                size: ProjectSettingsMainSize,
                content: (<ProjectSettingsInstall server={activeProject.server} editor={activeProject.editor} />),
              };
              break;
            case 'branding':
              main = {
                size: ProjectSettingsMainSize,
                content: (
                  <ProjectSettingsBranding server={activeProject.server} editor={activeProject.editor} />
                ),
              };
              break;
            case 'domain':
              main = {
                size: ProjectSettingsMainSize,
                content: (<ProjectSettingsDomain server={activeProject.server} editor={activeProject.editor} />),
              };
              break;
            case 'users':
              main = {
                size: ProjectSettingsMainSize,
                content: (<ProjectSettingsUsers server={activeProject.server} editor={activeProject.editor} />),
              };
              break;
            case 'landing':
              main = {
                size: ProjectSettingsMainSize,
                content: (<ProjectSettingsLanding server={activeProject.server} editor={activeProject.editor} />),
              };
              break;
            case 'feedback':
              main = {
                size: ProjectSettingsMainSize,
                content: (<ProjectSettingsFeedback server={activeProject.server} editor={activeProject.editor} />),
              };
              break;
            case 'roadmap':
              main = {
                size: ProjectSettingsMainSize,
                content: (<ProjectSettingsRoadmap server={activeProject.server} editor={activeProject.editor} />),
              };
              break;
            case 'changelog':
              main = {
                size: ProjectSettingsMainSize,
                content: (<ProjectSettingsChangelog server={activeProject.server} editor={activeProject.editor} />),
              };
              break;
            case 'data':
              main = {
                size: ProjectSettingsMainSize,
                content: (<ProjectSettingsData server={activeProject.server} />),
              };
              break;
          }
        }

        if (activeSubPath[0] === 'project') {
          barBottom = (activeProject?.hasUnsavedChanges()) ? (
            <div className={this.props.classes.unsavedChangesBar}>
              <Typography style={{ flexGrow: 100 }}>You have unsaved changes</Typography>
              <Button
                variant='contained'
                disableElevation
                color='primary'
                onClick={() => {
                  const currentProject = activeProject;
                  ServerAdmin.get().dispatchAdmin().then(d => d.configSetAdmin({
                    projectId: currentProject.projectId,
                    versionLast: currentProject.configVersion,
                    configAdmin: currentProject.editor.getConfig(),
                  })
                    .then((versionedConfigAdmin) => {
                      currentProject.resetUnsavedChanges(versionedConfigAdmin)
                    }));
                }}
              >
                Publish
              </Button>
            </div>
          ) : undefined;
        }
        break;
      default:
        setTitle('Page not found');
        main = { content: (<ErrorPage msg='Oops, cannot find page' />) };
        break;
    }
    if (showCreateProjectWarning) {
      main = { content: (<ErrorPage msg='Oops, you have to create a project first' />) };
      this.props.history.replace('/dashboard/welcome');
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

    const activeProjectConf = activeProject?.server.getStore().getState().conf.conf;
    const projectLink = (!!activeProjectConf && !!showProjectLink) ? (
      `${windowIso.location.protocol}//${activeProjectConf.domain || `${activeProjectConf.slug}.${windowIso.location.host}`}`
    ) : undefined;

    return (
      <Elements stripe={Dashboard.getStripePromise()}>
        {this.props.account && (
          <SubscriptionStatusNotifier account={this.props.account} />
        )}
        <Layout
          header={header}
          toolbarShow={!onboarding}
          toolbarLeft={(
            <div className={this.props.classes.toolbarLeft}>
              <Link to='/dashboard' className={this.props.classes.logoLink}>
                <Logo suppressMargins />
              </Link>
              <Tabs
                className={this.props.classes.tabs}
                variant='standard'
                scrollButtons='off'
                classes={{
                  indicator: this.props.classes.tabsIndicator,
                  flexContainer: this.props.classes.tabsFlexContainer,
                }}
                value={activePath}
                indicatorColor="primary"
                textColor="primary"
              >
                <Tab
                  className={this.props.classes.tab}
                  component={Link}
                  to='/dashboard/explorer'
                  value='explorer'
                  disableRipple
                  label='Explorer'
                  classes={{
                    root: this.props.classes.tabRoot,
                  }}
                />
                <Tab
                  className={this.props.classes.tab}
                  component={Link}
                  to='/dashboard/roadmap'
                  value='roadmap'
                  disableRipple
                  label='Roadmap'
                  classes={{
                    root: this.props.classes.tabRoot,
                  }}
                />
                <Tab
                  className={this.props.classes.tab}
                  component={Link}
                  to='/dashboard/users'
                  value='users'
                  disableRipple
                  label='Users'
                  classes={{
                    root: this.props.classes.tabRoot,
                  }}
                />
                <Tab
                  className={this.props.classes.tab}
                  component={Link}
                  to='/dashboard/comments'
                  value='comments'
                  disableRipple
                  label='Discussion'
                  classes={{
                    root: this.props.classes.tabRoot,
                  }}
                />
              </Tabs>
            </div>
          )}
          toolbarRight={
            <>
              <MenuItems
                items={[
                  ...(!!projectLink ? [{ type: 'button' as 'button', onClick: () => !windowIso.isSsr && windowIso.open(projectLink, '_blank'), title: 'Visit', icon: VisitIcon }] : []),
                  {
                    type: 'dropdown', title: this.props.account.name, items: [
                      ...(projects.filter(p => p.projectId !== activeProjectId).map(p => (
                        {
                          type: 'button' as 'button', onClick: () => {
                            const selectedProjectId = p.projectId;
                            if (selectedProjectId && this.state.selectedProjectId !== selectedProjectId) {
                              localStorage.setItem(SELECTED_PROJECT_ID_LOCALSTORAGE_KEY, selectedProjectId);
                              this.setState({
                                selectedProjectId,
                                preview: undefined,
                              });
                            }
                          }, title: p.editor.getConfig().name
                        }
                      ))),
                      { type: 'button', link: '/dashboard/create', title: 'Add project', icon: AddIcon },
                      { type: 'divider' },
                      { type: 'button', link: '/dashboard/settings', title: 'Settings', icon: SettingsIcon },
                      { type: 'divider' },
                      { type: 'button', link: this.openFeedbackUrl('docs'), linkIsExternal: true, title: 'Documentation' },
                      { type: 'button', link: this.openFeedbackUrl('feedback'), linkIsExternal: true, title: 'Give Feedback' },
                      { type: 'button', link: this.openFeedbackUrl('roadmap'), linkIsExternal: true, title: 'Our Roadmap' },
                      { type: 'divider' },
                      {
                        type: 'button', onClick: () => {
                          ServerAdmin.get().dispatchAdmin().then(d => d.accountLogoutAdmin());
                          redirectIso('/login');
                        }, title: 'Sign out', icon: LogoutIcon
                      },
                    ]
                  }
                ]}
              />
            </>
          }
          previewShow={!!this.state.previewShow}
          previewShowChanged={show => this.setState({ previewShow: show })}
          preview={preview}
          menu={menu}
          barTop={barTop}
          barBottom={barBottom}
          contentMargins={!!showContentMargins}
          main={main || { content: (<ErrorPage msg='Oops, cannot find page' />) }}
        />
      </Elements>
    );
  }

  renderProjectUserSelect(activeProject: AdminProject) {
    return (
      <Provider key={activeProject.projectId} store={activeProject.server.getStore()}>
        <UserSelection
          className={this.props.classes.projectUserSelectorInline}
          server={activeProject.server}
          allowCreate
          allowClear
          alwaysOverrideWithLoggedInUser
          placeholder='Anonymous'
          minWidth={76} // Fits placeholder
          maxWidth={150}
          suppressInitialOnChange
          SelectionPickerProps={{
            autocompleteClasses: {
              inputRoot: this.props.classes.projectUserSelectorInlineInputRoot,
            }
          }}
          onChange={userLabel => {
            if (userLabel) {
              activeProject.server.dispatchAdmin().then(d => d.userLoginAdmin({
                projectId: activeProject.projectId,
                userId: userLabel.value,
              }));
            } else {
              if (this.state.preview?.type === 'user'
                && this.state.preview.id === activeProject.server.getStore().getState().users.loggedIn.user?.userId) {
                this.setState({ preview: undefined });
              }
              activeProject.server.dispatch().then(d => d.userLogout({
                projectId: activeProject.projectId,
              }));
            }
          }}
        />
      </Provider>
    );
  }

  renderPreviewPost(postId: string, project?: AdminProject): PreviewSection {
    if (!project) {
      return this.renderPreviewEmpty('No project selected');
    }
    return {
      size: PostPreviewSize,
      // bar: (
      //   <div className={this.props.classes.previewBarText}>
      //     Viewing post as&nbsp;
      //     {this.renderProjectUserSelect(project)}
      //   </div>
      // ),
      content: (
        <Provider key={project.projectId} store={project.server.getStore()}>
          <DashboardPost
            key={postId}
            server={project.server}
            postId={postId}
            onClickPost={postId => this.pageClicked('post', [postId])}
            onUserClick={userId => this.pageClicked('user', [userId])}
          />
        </Provider>
      ),
    };
  }

  renderPreviewUser(userId: string, project?: AdminProject): PreviewSection {
    if (!project) {
      return this.renderPreviewEmpty('No project selected');
    }
    return {
      size: UserPreviewSize,
      bar: (
        <div className={this.props.classes.previewBarText}>
          Viewing user profile as&nbsp;
          {this.renderProjectUserSelect(project)}
        </div>
      ),
      content: (
        <Provider key={project.projectId} store={project.server.getStore()}>
          <UserPage key={userId} server={project.server} userId={userId} />
        </Provider>
      ),
    };
  }

  renderPreviewPostCreate(project?: AdminProject): PreviewSection {
    if (!project) {
      return this.renderPreviewEmpty('No project selected');
    }
    return {
      size: PostPreviewSize,
      bar: '',
      content: (
        <div>
          TODO post create
        </div>
      ),
    };
  }

  renderPreviewUserCreate(project?: AdminProject): PreviewSection {
    if (!project) {
      return this.renderPreviewEmpty('No project selected');
    }
    return {
      size: UserPreviewSize,
      bar: '',
      content: (
        <div>
          TODO user create
        </div>
      ),
    };
  }

  renderPreviewCreateDemo(): PreviewSection {
    return {
      size: {},
      bar: 'Preview with sample data.',
      content: this.createProject ? (
        <DemoApp
          key={this.createProject.server.getStore().getState().conf.ver || 'preview-create-project'}
          server={this.createProject.server}
          settings={{ suppressSetTitle: true }}
        />
      ) : (
        <LoadingPage />
      ),
    };
  }

  renderPreviewChangesDemo(project?: AdminProject): PreviewSection {
    if (!project) {
      return this.renderPreviewEmpty('No project selected');
    }
    return {
      size: ProjectPreviewSize,
      bar: 'Preview changes live',
      content: (
        <DemoApp
          key={project.configVersion}
          server={project.server}
          settings={{ suppressSetTitle: true }}
          forcePathSubscribe={listener => this.forcePathListener = listener}
        />
      ),
    };
  }

  renderPreviewEmpty(msg: string, size?: LayoutSize): PreviewSection {
    return {
      size: size || { breakWidth: 350, flexGrow: 100, maxWidth: 1024 },
      content: (
        <div className={this.props.classes.previewEmptyMessage}>
          <Typography component='div' variant='h5'>
            {msg}
          </Typography>
          <EmptyIcon
            fontSize='inherit'
            className={this.props.classes.previewEmptyIcon}
          />
        </div>
      ),
    };
  }

  openFeedbackUrl(page?: string) {
    var url = `${windowIso.location.protocol}//feedback.${windowIso.location.host}/${page || ''}`;
    if (this.props.account) {
      url += `?${SSO_TOKEN_PARAM_NAME}=${this.props.account.cfJwt}`;
    }
    return url;
  }

  pageClicked(path: string, subPath: ConfigEditor.Path = []): void {
    if (path === 'post') {
      this.setState({
        previewShow: true,
        explorerPreview: !!subPath[0]
          ? { type: 'post', id: subPath[0] + '' }
          : { type: 'create' },
      }, () => this.props.history.push('/dashboard/explorer'));
    } else if (path === 'user') {
      this.setState({
        previewShow: true,
        usersPreview: !!subPath[0]
          ? { type: 'user', id: subPath[0] + '' }
          : { type: 'create' },
      }, () => this.props.history.push('/dashboard/users'));
    } else {
      this.props.history.push(`/dashboard/${[path, ...subPath].join('/')}`);
    }
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
}, null, null, { forwardRef: true })(withStyles(styles, { withTheme: true })(withWidth({ initialWidth })(Dashboard)));
