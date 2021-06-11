import { Button, Collapse, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Divider, IconButton, Tab, Tabs, Typography, withWidth, WithWidthProps } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import AddIcon from '@material-ui/icons/Add';
import EmptyIcon from '@material-ui/icons/BlurOn';
import CodeIcon from '@material-ui/icons/Code';
import SettingsIcon from '@material-ui/icons/Settings';
import VisibilityIcon from '@material-ui/icons/Visibility';
import { Elements } from '@stripe/react-stripe-js';
import { Stripe } from '@stripe/stripe-js';
import { loadStripe } from '@stripe/stripe-js/pure';
import React, { Component } from 'react';
import { DragDropContext } from 'react-beautiful-dnd';
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
import DividerVertical from '../app/utils/DividerVertical';
import SubscriptionStatusNotifier from '../app/utils/SubscriptionStatusNotifier';
import * as ConfigEditor from '../common/config/configEditor';
import Templater from '../common/config/configTemplater';
import ConfigView from '../common/config/settings/ConfigView';
import Menu, { MenuHeading, MenuItem, MenuProject } from '../common/config/settings/Menu';
import Page from '../common/config/settings/Page';
import { ChangelogInstance } from '../common/config/template/changelog';
import { FeedbackInstance } from '../common/config/template/feedback';
import { LandingInstance } from '../common/config/template/landing';
import { RoadmapInstance } from '../common/config/template/roadmap';
import { contentScrollApplyStyles, Orientation } from '../common/ContentScroll';
import { tabHoverApplyStyles } from '../common/DropdownTab';
import LogoutIcon from '../common/icon/LogoutIcon';
import VisitIcon from '../common/icon/VisitIcon';
import Layout, { Header, LayoutSize, LayoutState, PreviewSection, Section } from '../common/Layout';
import { MenuItems } from '../common/menus';
import UserFilterControls from '../common/search/UserFilterControls';
import SubmitButton from '../common/SubmitButton';
import debounce, { SearchTypeDebounceTime } from '../common/util/debounce';
import { detectEnv, Environment, isProd } from '../common/util/detectEnv';
import { escapeHtml } from '../common/util/htmlUtil';
import { RedirectIso, redirectIso } from '../common/util/routerUtil';
import { initialWidth } from '../common/util/screenUtil';
import setTitle from '../common/util/titleUtil';
import windowIso from '../common/windowIso';
import BillingPage, { BillingPaymentActionRedirect, BillingPaymentActionRedirectPath } from './dashboard/BillingPage';
import CreatedPage from './dashboard/CreatedPage';
import CreatePage from './dashboard/CreatePage';
import DashboardHome from './dashboard/DashboardHome';
import DashboardPost from './dashboard/DashboardPost';
import DashboardPostActions from './dashboard/DashboardPostActions';
import DashboardPostFilterControls from './dashboard/DashboardPostFilterControls';
import DashboardSearchControls from './dashboard/DashboardSearchControls';
import PostList from './dashboard/PostList';
import { ProjectSettingsBase, ProjectSettingsBranding, ProjectSettingsChangelog, ProjectSettingsData, ProjectSettingsDomain, ProjectSettingsFeedback, ProjectSettingsInstall, ProjectSettingsInstallPortal, ProjectSettingsInstallWidget, ProjectSettingsLanding, ProjectSettingsRoadmap, ProjectSettingsUsers, ProjectSettingsUsersOauth, ProjectSettingsUsersOnboarding, ProjectSettingsUsersSso, TemplateWrapper } from './dashboard/ProjectSettings';
import RoadmapExplorer from './dashboard/RoadmapExplorer';
import SettingsPage from './dashboard/SettingsPage';
import UserList from './dashboard/UserList';
import UserSelection from './dashboard/UserSelection';
import WelcomePage from './dashboard/WelcomePage';
import DemoApp, { getProject, Project as DemoProject } from './DemoApp';
import Logo from './Logo';

export const getProjectLink = (config: Pick<AdminClient.Config, 'domain' | 'slug'>): string => {
  return `${windowIso.location.protocol}//${escapeHtml(config.domain) || `${escapeHtml(config.slug)}.${windowIso.location.host}`}`
}

const SELECTED_PROJECT_ID_LOCALSTORAGE_KEY = 'dashboard-selected-project-id';
const SELECTED_PROJECT_ID_PARAM_NAME = 'projectId';
const PostPreviewSize: LayoutSize = { breakWidth: 640, flexGrow: 100, maxWidth: 876 };
const UserPreviewSize: LayoutSize = { breakWidth: 350, flexGrow: 100, maxWidth: 1024 };
const ProjectPreviewSize: LayoutSize = { breakWidth: 500, flexGrow: 100, maxWidth: 1024 };
const ProjectSettingsMainSize: LayoutSize = { breakWidth: 500, flexGrow: 100, maxWidth: 'max-content', scroll: Orientation.Both };

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
    width: '100%',
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
  feedbackAndListContainer: {
    display: 'flex',
    alignItems: 'stretch',
    height: '100%',
  },
  listWithSearchContainer: {
    minWidth: 0,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  listContainer: {
    flexGrow: 1,
    minHeight: 0,
    ...contentScrollApplyStyles({ theme, orientation: Orientation.Vertical }),
  },
});
interface Props {
}
interface ConnectProps {
  accountStatus?: Status;
  account?: AdminClient.AccountAdmin;
  isSuperAdmin: boolean;
  configsStatus?: Status;
  configVers: string;
  bindByProjectId?: { [projectId: string]: AdminClient.ConfigAndBindAllResultByProjectId };
}
interface State {
  currentPagePath: ConfigEditor.Path;
  binding?: boolean;
  selectedProjectId?: string;
  accountSearch?: AdminClient.Account[];
  accountSearching?: string;
  previewShow?: boolean;
  publishDialogShown?: boolean;
  publishDialogStep?: number;
  publishDialogSubmitting?: boolean;
  publishDialogInviteMods?: string[];
  // Below is state for individual pages
  // It's not very nice to be here in one place, but it does allow for state
  // to persist between page clicks
  settingsPreviewChanges?: 'live' | 'code';
  explorerPostSearch?: AdminClient.IdeaSearchAdmin;
  explorerPreview?: { type: 'create' } | { type: 'post', id: string },
  feedbackPostSearch?: AdminClient.IdeaSearchAdmin;
  feedbackPreview?: { type: 'create' } | { type: 'post', id: string },
  usersUserFilter?: Partial<AdminClient.UserSearchAdmin>;
  usersUserSearch?: string;
  usersPreview?: { type: 'create' } | { type: 'user', id: string },
  // Below is state for various template options that are updated after publish
  // Null means, we received it, but its not present, undefined means we are still waiting
  landing?: LandingInstance | null;
  feedback?: FeedbackInstance | null;
  roadmap?: RoadmapInstance | null;
  changelog?: ChangelogInstance | null;
}
class Dashboard extends Component<Props & ConnectProps & RouteComponentProps & WithStyles<typeof styles, true> & WithWidthProps, State> {
  static stripePromise: Promise<Stripe | null> | undefined;
  unsubscribes: { [projectId: string]: () => void } = {};
  createProjectPromise: Promise<DemoProject> | undefined = undefined;
  createProject: DemoProject | undefined = undefined;
  forcePathListener: ((forcePath: string) => void) | undefined;
  readonly searchAccounts: (newValue: string) => void;
  lastConfigVars?: string;
  similarPostWasClicked?: {
    originalPostId: string;
    similarPostId: string;
  };

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

    if (activeProject && this.lastConfigVars !== this.props.configVers) {
      this.lastConfigVars = this.props.configVers;
      const templater = Templater.get(activeProject.editor);
      templater.feedbackGet().then(i => this.setState({ feedback: i || null }));
      templater.roadmapGet().then(i => this.setState({ roadmap: i || null }));
      templater.landingGet().then(i => this.setState({ landing: i || null }));
      templater.changelogGet().then(i => this.setState({ changelog: i || null }));
    }

    var header: Header | undefined;
    var main: Section | undefined;
    var barTop: React.ReactNode | undefined;
    var barBottom: React.ReactNode | undefined;
    var onboarding = false;
    var preview: PreviewSection | undefined;
    var previewOnClose: (() => void) | undefined;
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
      case 'explore':
        setTitle('Explore - Dashboard');
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
        const explorerPostSearch = {
          ...this.state.explorerPostSearch,
          // This along with forceSingleCategory ensures one and only one category is selected
          filterCategoryIds: this.state.explorerPostSearch?.filterCategoryIds?.length
            ? this.state.explorerPostSearch.filterCategoryIds
            : (activeProject.editor.getConfig().content.categories.length
              ? [activeProject.editor.getConfig().content.categories[0]?.categoryId]
              : undefined),
          // Sort by new by default
          sortBy: this.state.explorerPostSearch?.sortBy || AdminClient.IdeaSearchAdminSortByEnum.New,
        };
        const explorerFilters = (layoutState: LayoutState) => (
          <Provider key={activeProject.projectId} store={activeProject.server.getStore()}>
            <DashboardPostFilterControls
              key={activeProject.server.getProjectId()}
              server={activeProject.server}
              search={explorerPostSearch}
              onSearchChanged={explorerPostSearch => this.setState({ explorerPostSearch })}
              horizontal={layoutState.overflowMenu}
            />
          </Provider>
        );
        menu = {
          size: { breakWidth: 200, flexGrow: 100, width: 'max-content', maxWidth: 'max-content' },
          content: layoutState => layoutState.overflowMenu ? null : explorerFilters(layoutState),
        };
        main = {
          size: { breakWidth: 350, flexGrow: 20, maxWidth: 1024 },
          content: layoutState => (
            <>
              <DashboardSearchControls
                key={'explorer-search-bar' + activeProject.server.getProjectId()}
                searchText={explorerPostSearch.searchText || ''}
                onSearchChanged={searchText => this.setState({
                  explorerPostSearch: {
                    ...this.state.explorerPostSearch,
                    searchText,
                  }
                })}
                filters={!layoutState.overflowMenu ? null : explorerFilters(layoutState)}
              />
              <Divider />
              <Provider key={activeProject.projectId} store={activeProject.server.getStore()}>
                <PostList
                  key={activeProject.server.getProjectId()}
                  server={activeProject.server}
                  search={explorerPostSearch}
                  onClickPost={postId => this.pageClicked('post', [postId])}
                  onUserClick={userId => this.pageClicked('user', [userId])}
                  selectedPostId={this.state.explorerPreview?.type === 'post' ? this.state.explorerPreview.id : undefined}
                />
              </Provider>
            </>
          ),
        };
        if (this.state.explorerPreview?.type === 'create') {
          preview = this.renderPreviewPostCreate(activeProject);
        } else if (this.state.explorerPreview?.type === 'post') {
          preview = this.renderPreviewPost(this.state.explorerPreview.id, activeProject);
        } else {
          preview = this.renderPreviewEmpty('No post selected', PostPreviewSize);
        }

        showProjectLink = true;
        break;
      case 'feedback':
        setTitle('Feedback - Dashboard');
        if (!activeProject) {
          showCreateProjectWarning = true;
          break;
        }
        header = {
          title: 'Feedback',
          action: {
            label: 'Create',
            onClick: () => this.pageClicked('post'),
          },
        };
        const feedbackPostSearch = this.state.feedbackPostSearch || {
          sortBy: AdminClient.IdeaSearchAdminSortByEnum.New,
          ...(this.state.feedback?.categoryAndIndex.category.workflow.entryStatus ? {
            filterStatusIds: [this.state.feedback.categoryAndIndex.category.workflow.entryStatus],
          } : {}),
        };
        const feedbackFilters = (layoutState: LayoutState) => (
          <Provider key={activeProject.projectId} store={activeProject.server.getStore()}>
            <DashboardPostFilterControls
              key={activeProject.server.getProjectId()}
              server={activeProject.server}
              search={feedbackPostSearch}
              allowSearch={{ enableSearchByCategory: false }}
              permanentSearch={{ filterCategoryIds: this.state.feedback ? [this.state.feedback.categoryAndIndex.category.categoryId] : undefined }}
              onSearchChanged={feedbackPostSearch => this.setState({ feedbackPostSearch })}
              horizontal={layoutState.overflowMenu}
            />
          </Provider>
        );
        menu = {
          size: { breakWidth: 200, flexGrow: 100, width: 'max-content', maxWidth: 'max-content' },
          content: layoutState => layoutState.overflowMenu ? null : feedbackFilters(layoutState),
        };
        if (this.similarPostWasClicked && this.similarPostWasClicked.similarPostId !== this.state.feedbackPreview?.['id']) {
          this.similarPostWasClicked = undefined;
        }
        main = {
          size: { breakWidth: 550, flexGrow: 20, maxWidth: 1024 },
          content: layoutState => (
            <div className={this.props.classes.feedbackAndListContainer}>
              <div className={this.props.classes.listWithSearchContainer}>
                <DashboardSearchControls
                  key={'feedback-search-bar' + activeProject.server.getProjectId()}
                  searchText={feedbackPostSearch.searchText || ''}
                  onSearchChanged={searchText => this.setState({
                    feedbackPostSearch: {
                      ...this.state.feedbackPostSearch,
                      searchText,
                    }
                  })}
                  filters={!layoutState.overflowMenu ? null : feedbackFilters(layoutState)}
                />
                <Divider />
                <div className={this.props.classes.listContainer}>
                  <Provider key={activeProject.projectId} store={activeProject.server.getStore()}>
                    <PostList
                      dragndrop
                      key={activeProject.server.getProjectId()}
                      server={activeProject.server}
                      search={feedbackPostSearch}
                      onClickPost={postId => this.pageClicked('post', [postId])}
                      onUserClick={userId => this.pageClicked('user', [userId])}
                      selectedPostId={this.state.feedbackPreview?.type === 'post' ? this.state.feedbackPreview.id : undefined}
                    />
                  </Provider>
                </div>
              </div>
              <DividerVertical />
              <DashboardPostActions
                activeProject={activeProject}
                onClickPost={postId => this.pageClicked('post', [postId])}
                onUserClick={userId => this.pageClicked('user', [userId])}
                selectedPostId={this.state.feedbackPreview?.type === 'post' ? this.state.feedbackPreview.id : undefined}
                feedback={this.state.feedback}
              />
            </div>
          ),
        };

        if (this.state.feedbackPreview?.type === 'create') {
          preview = this.renderPreviewPostCreate(activeProject);
        } else if (this.state.feedbackPreview?.type === 'post') {
          preview = this.renderPreviewPost(this.state.feedbackPreview.id, activeProject);
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
            <TemplateWrapper<RoadmapInstance | undefined>
              key='roadmap'
              editor={activeProject.editor}
              mapper={templater => templater.roadmapGet()}
              renderResolved={(templater, roadmap) => !!roadmap && (
                <Provider key={activeProject.projectId} store={activeProject.server.getStore()}>
                  <RoadmapExplorer key={activeProject.server.getProjectId()} server={activeProject.server} roadmap={roadmap} />
                </Provider>
              )}
            />
          ),
        };
        showProjectLink = true;
        break;
      case 'changelog':
        setTitle('Changelog - Dashboard');
        if (!activeProject) {
          showCreateProjectWarning = true;
          break;
        }
        main = {
          size: { breakWidth: 1000 },
          content: (
            <TemplateWrapper<ChangelogInstance | undefined>
              key='changelog'
              editor={activeProject.editor}
              mapper={templater => templater.changelogGet()}
              renderResolved={(templater, changelog) => !!changelog?.pageAndIndex && (
                <Provider key={activeProject.projectId} store={activeProject.server.getStore()}>
                  {'TODO <ChangelogWriter key={activeProject.server.getProjectId()} server={activeProject.server} changelog={changelog} />'}
                </Provider>
              )}
            />
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
                  { type: 'item', slug: 'settings/project/landing', name: 'Landing', offset: 1 } as MenuItem,
                  { type: 'item', slug: 'settings/project/feedback', name: 'Feedback', offset: 1 } as MenuItem,
                  { type: 'item', slug: 'settings/project/roadmap', name: 'Roadmap', offset: 1 } as MenuItem,
                  { type: 'item', slug: 'settings/project/changelog', name: 'Changelog', offset: 1 } as MenuItem,
                  { type: 'item', slug: 'settings/project/onboard', name: 'Onboard', offset: 1 } as MenuItem,
                  { type: 'item', slug: 'settings/project/onboard/sso', name: 'SSO', offset: 2 } as MenuItem,
                  { type: 'item', slug: 'settings/project/onboard/oauth', name: 'OAuth', offset: 2 } as MenuItem,
                  { type: 'item', slug: 'settings/project/install', name: 'Install', offset: 1 } as MenuItem,
                  { type: 'item', slug: 'settings/project/branding', name: 'Branding', offset: 2 } as MenuItem,
                  { type: 'item', slug: 'settings/project/domain', name: 'Domain', offset: 2 } as MenuItem,
                  { type: 'item', slug: 'settings/project/data', name: 'Data', offset: 1 } as MenuItem,
                  { type: 'heading', text: 'Advanced' } as MenuHeading,
                  {
                    type: 'project',
                    name: 'General',
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
                  pageClicked={path => this.pageClicked(activePath, ['project', 'advanced', ...path])}
                />
              </ProjectSettingsBase>
            )
          };
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
            case 'onboard':
              if (activeSubPath[2] === 'sso') {
                main = {
                  size: ProjectSettingsMainSize,
                  content: (<ProjectSettingsUsersSso server={activeProject.server} editor={activeProject.editor} />),
                };
              } else if (activeSubPath[2] === 'oauth') {
                main = {
                  size: ProjectSettingsMainSize,
                  content: (<ProjectSettingsUsersOauth server={activeProject.server} editor={activeProject.editor} />),
                };
              } else {
                main = {
                  size: ProjectSettingsMainSize,
                  content: (<ProjectSettingsUsers server={activeProject.server} editor={activeProject.editor} />),
                };
              }
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
              {!this.state.settingsPreviewChanges && (
                <Button
                  variant='text'
                  color='default'
                  style={{ marginLeft: 8 }}
                  onClick={() => this.setState({
                    previewShow: true,
                    settingsPreviewChanges: 'live',
                  })}
                >
                  Preview
                </Button>
              )}
              <Button
                variant='contained'
                disableElevation
                color='primary'
                style={{ marginLeft: 8 }}
                onClick={() => this.publishChanges(activeProject)
                  .then(versionedConfigAdmin => this.setState({ settingsPreviewChanges: undefined }))}
              >
                Publish
              </Button>
            </div>
          ) : undefined;
        }

        if (!!this.state.settingsPreviewChanges) {
          previewOnClose = () => this.setState({ settingsPreviewChanges: undefined });
          preview = this.renderPreviewChangesDemo(activeProject,
            activeSubPath[0] === 'project' && activeSubPath[1] === 'advanced',
            this.state.settingsPreviewChanges === 'code' ? activeProject : undefined);
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

    const notYetPublished = !!activeProject?.editor.getConfig().notYetPublished;
    const activeProjectConf = activeProject?.server.getStore().getState().conf.conf;
    const projectLink = (!!activeProjectConf && !!showProjectLink)
      ? getProjectLink(activeProjectConf) : undefined;

    return (
      <Elements stripe={Dashboard.getStripePromise()}>
        {this.props.account && (
          <SubscriptionStatusNotifier account={this.props.account} />
        )}
        <DragDropContext onDragEnd={(result, provided) => { }}>
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
                    to='/dashboard/explore'
                    value='explore'
                    disableRipple
                    label='Explore'
                    classes={{
                      root: this.props.classes.tabRoot,
                    }}
                  />
                  {this.state.feedback !== null && (
                    <Tab
                      className={this.props.classes.tab}
                      component={Link}
                      to='/dashboard/feedback'
                      value='feedback'
                      disableRipple
                      label='Feedback'
                      classes={{
                        root: this.props.classes.tabRoot,
                      }}
                    />
                  )}
                  {this.state.roadmap !== null && (
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
                  )}
                  {this.state.changelog !== null && (
                    <Tab
                      className={this.props.classes.tab}
                      component={Link}
                      to='/dashboard/changelog'
                      value='changelog'
                      disableRipple
                      label='Changelog'
                      classes={{
                        root: this.props.classes.tabRoot,
                      }}
                    />
                  )}
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
                </Tabs>
              </div>
            )}
            toolbarRight={
              <>
                <MenuItems
                  items={[
                    ...((!!projectLink && !notYetPublished) ? [{ type: 'button' as 'button', onClick: () => !windowIso.isSsr && windowIso.open(projectLink, '_blank'), title: 'Visit', icon: VisitIcon }] : []),
                    ...((!!notYetPublished) ? [{ type: 'button' as 'button', onClick: () => this.setState({ publishDialogShown: !this.state.publishDialogShown }), title: 'Publish', primary: true, icon: VisitIcon }] : []),
                    {
                      type: 'dropdown', title: this.props.account.name, items: [
                        ...(projects.filter(p => p.projectId !== activeProjectId).map(p => (
                          {
                            type: 'button' as 'button', onClick: () => {
                              const selectedProjectId = p.projectId;
                              if (selectedProjectId && this.state.selectedProjectId !== selectedProjectId) {
                                localStorage.setItem(SELECTED_PROJECT_ID_LOCALSTORAGE_KEY, selectedProjectId);
                                this.setState({ selectedProjectId });
                              }
                            }, title: p.editor.getConfig().name
                          }
                        ))),
                        { type: 'button', link: '/dashboard/create', title: 'Add project', icon: AddIcon },
                        { type: 'divider' },
                        { type: 'button', link: '/dashboard/settings/account/profile', title: 'Settings', icon: SettingsIcon },
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
            previewShowChanged={show => {
              this.setState({ previewShow: show });
              !show && previewOnClose?.();
            }}
            preview={preview}
            previewForceShowClose={!!previewOnClose}
            menu={menu}
            barTop={barTop}
            barBottom={barBottom}
            contentMargins={!!showContentMargins}
            main={main || { content: (<ErrorPage msg='Oops, cannot find page' />) }}
          />
          {!!activeProject && (notYetPublished || this.state.publishDialogShown) && (
            <Dialog
              maxWidth='md'
              fullWidth={this.props.width === 'xs'}
              open={!!this.state.publishDialogShown}
              onClose={() => this.setState({ publishDialogShown: false })}
              scroll='body'
              PaperProps={{
                style: { maxWidth: 730 },
              }}
            >
              <Collapse in={(this.state.publishDialogStep || 0) === 0}>
                <DialogTitle>User onboarding</DialogTitle>
                <DialogContent>
                  <DialogContentText>Choose how your users will access your portal</DialogContentText>
                  <ProjectSettingsUsersOnboarding
                    server={activeProject.server}
                    editor={activeProject.editor}
                    onPageClicked={() => this.setState({ publishDialogShown: false })}
                    inviteMods={this.state.publishDialogInviteMods || []}
                    setInviteMods={mods => this.setState({ publishDialogInviteMods: mods })}
                  />
                </DialogContent>
              </Collapse>
              <Collapse in={(this.state.publishDialogStep || 0) === 1}>
                <DialogTitle>Installation</DialogTitle>
                <DialogContent>
                  <DialogContentText>Choose how to link your product with your ClearFlask portal</DialogContentText>
                  <ProjectSettingsInstallPortal server={activeProject.server} editor={activeProject.editor} />
                  <ProjectSettingsInstallWidget server={activeProject.server} editor={activeProject.editor} />
                </DialogContent>
              </Collapse>
              <DialogActions>
                <Button onClick={() => this.setState({ publishDialogShown: false })}>Cancel</Button>
                {(this.state.publishDialogStep || 0) === 0 && (
                  <SubmitButton
                    isSubmitting={this.state.publishDialogSubmitting}
                    color='primary'
                    variant='contained'
                    disableElevation
                    onClick={async e => {
                      if (!activeProject) return;
                      this.setState({ publishDialogSubmitting: true });
                      (activeProject.editor.getProperty(['notYetPublished']) as ConfigEditor.BooleanProperty).set(false);
                      try {
                        await this.publishChanges(activeProject);
                      } catch (e) {
                        this.setState({ publishDialogSubmitting: false });
                        return;
                      }
                      const d = await activeProject.server.dispatchAdmin();
                      const inviteModsRemaining = new Set(this.state.publishDialogInviteMods);
                      try {
                        for (const mod of this.state.publishDialogInviteMods || []) {
                          d.userCreateAdmin({
                            projectId: activeProject.server.getProjectId(),
                            userCreateAdmin: {
                              email: mod,
                            },
                          });
                          inviteModsRemaining.delete(mod);
                        }
                      } catch (e) {
                        this.setState({ publishDialogSubmitting: false });
                        return;
                      } finally {
                        this.setState({ publishDialogInviteMods: [...inviteModsRemaining] });
                      }
                      this.setState({
                        publishDialogSubmitting: false,
                        publishDialogStep: (this.state.publishDialogStep || 0) + 1,
                      });
                    }}>Publish</SubmitButton>
                )}
                {(this.state.publishDialogStep || 0) === 1 && (
                  <Button
                    color='primary'
                    variant='contained'
                    disableElevation
                    onClick={e => {
                      !windowIso.isSsr && windowIso.open(projectLink, '_blank');
                      this.setState({
                        publishDialogShown: false,
                      });
                    }}>Visit</Button>
                )}
              </DialogActions>
            </Dialog>
          )}
        </DragDropContext>
      </Elements>
    );
  }

  async publishChanges(currentProject: AdminProject): Promise<AdminClient.VersionedConfigAdmin> {
    const d = await ServerAdmin.get().dispatchAdmin();
    const versionedConfigAdmin = await d.configSetAdmin({
      projectId: currentProject.projectId,
      versionLast: currentProject.configVersion,
      configAdmin: currentProject.editor.getConfig(),
    });
    currentProject.resetUnsavedChanges(versionedConfigAdmin);
    return versionedConfigAdmin;
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

  renderPreviewChangesDemo(project?: AdminProject, allowCode?: boolean, showCodeForProject?: AdminProject): PreviewSection {
    if (!project) {
      return this.renderPreviewEmpty('No project selected');
    }
    return {
      size: ProjectPreviewSize,
      bar: (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          Preview changes live
          <div style={{ flexGrow: 1 }} />
          {(!!allowCode || !!showCodeForProject) && (
            <IconButton onClick={() => this.setState({
              settingsPreviewChanges: !!showCodeForProject ? 'live' : 'code',
            })}>
              {!!showCodeForProject ? <VisibilityIcon /> : <CodeIcon />}
            </IconButton>
          )}
        </div>
      ),
      content: !showCodeForProject ? (
        <DemoApp
          key={project.configVersion}
          server={project.server}
          settings={{ suppressSetTitle: true }}
          forcePathSubscribe={listener => this.forcePathListener = listener}
        />
      ) : (
        <ConfigView server={showCodeForProject.server} editor={showCodeForProject.editor} />
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
      const activePath = this.props.match.params['path'] || '';
      const preview: State['explorerPreview'] & State['feedbackPreview'] = !!subPath[0]
        ? { type: 'post', id: subPath[0] + '' }
        : { type: 'create' };
      if (activePath === 'feedback') {
        this.setState({
          previewShow: true,
          feedbackPreview: preview,
        });
      } else if (activePath === 'explore') {
        this.setState({
          previewShow: true,
          explorerPreview: preview,
        });
      } else {
        this.setState({
          previewShow: true,
          explorerPreview: preview,
        }, () => this.props.history.push('/dashboard/explore'));
      }
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
    configVers: Object.values(state.configs.configs.byProjectId || {}).map(c => c.config.version).join('/'),
    bindByProjectId: state.configs.configs.byProjectId,
  };
  return connectProps;
}, null, null, { forwardRef: true })(withStyles(styles, { withTheme: true })(withWidth({ initialWidth })(Dashboard)));
