import { Button, Collapse, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Divider, Hidden, IconButton, Tab, Tabs, Typography, withWidth, WithWidthProps } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import AddIcon from '@material-ui/icons/Add';
import EmptyIcon from '@material-ui/icons/BlurOn';
import CodeIcon from '@material-ui/icons/Code';
import SettingsIcon from '@material-ui/icons/Settings';
import VisibilityIcon from '@material-ui/icons/Visibility';
import { Elements } from '@stripe/react-stripe-js';
import { Stripe } from '@stripe/stripe-js';
import { loadStripe } from '@stripe/stripe-js/pure';
import { VariantType, withSnackbar, WithSnackbarProps } from 'notistack';
import React, { Component } from 'react';
import { DragDropContext, SensorAPI } from 'react-beautiful-dnd';
import { connect, Provider } from 'react-redux';
import { Redirect, RouteComponentProps } from 'react-router';
import { Link } from 'react-router-dom';
import * as AdminClient from '../api/admin';
import { Status } from '../api/server';
import ServerAdmin, { Project as AdminProject, ReduxStateAdmin } from '../api/serverAdmin';
import { SSO_TOKEN_PARAM_NAME } from '../app/App';
import LogIn from '../app/comps/LogIn';
import { PanelPostNavigator } from '../app/comps/PanelPost';
import PostCreateForm from '../app/comps/PostCreateForm';
import { Label } from '../app/comps/SelectionPicker';
import UserPage from '../app/comps/UserPage';
import { BoardContainer, BoardPanel } from '../app/CustomPage';
import ErrorPage from '../app/ErrorPage';
import LoadingPage from '../app/LoadingPage';
import SubscriptionStatusNotifier from '../app/utils/SubscriptionStatusNotifier';
import * as ConfigEditor from '../common/config/configEditor';
import Templater from '../common/config/configTemplater';
import ConfigView from '../common/config/settings/ConfigView';
import { ChangelogInstance } from '../common/config/template/changelog';
import { FeedbackInstance } from '../common/config/template/feedback';
import { LandingInstance } from '../common/config/template/landing';
import { RoadmapInstance } from '../common/config/template/roadmap';
import { contentScrollApplyStyles, Orientation } from '../common/ContentScroll';
import { tabHoverApplyStyles } from '../common/DropdownTab';
import LogoutIcon from '../common/icon/LogoutIcon';
import VisitIcon from '../common/icon/VisitIcon';
import Layout, { LayoutSize, Section } from '../common/Layout';
import { MenuItems } from '../common/menus';
import SubmitButton from '../common/SubmitButton';
import debounce, { SearchTypeDebounceTime } from '../common/util/debounce';
import { detectEnv, Environment, isProd } from '../common/util/detectEnv';
import { escapeHtml } from '../common/util/htmlUtil';
import { createMutableRef } from '../common/util/refUtil';
import { RedirectIso, redirectIso } from '../common/util/routerUtil';
import { initialWidth } from '../common/util/screenUtil';
import Subscription from '../common/util/subscriptionUtil';
import setTitle from '../common/util/titleUtil';
import windowIso from '../common/windowIso';
import { BillingPaymentActionRedirect, BillingPaymentActionRedirectPath } from './dashboard/BillingPage';
import CreatedPage from './dashboard/CreatedPage';
import CreatePage from './dashboard/CreatePage';
import { renderChangelog } from './dashboard/dashboardChangelog';
import { dashboardOnDragEnd, OnDndHandled } from './dashboard/dashboardDndActionHandler';
import { renderExplore } from './dashboard/dashboardExplore';
import { renderFeedback } from './dashboard/dashboardFeedback';
import DashboardHome from './dashboard/DashboardHome';
import DashboardPost from './dashboard/DashboardPost';
import { renderRoadmap } from './dashboard/dashboardRoadmap';
import { renderSettings } from './dashboard/dashboardSettings';
import { renderUsers } from './dashboard/dashboardUsers';
import { ProjectSettingsInstallPortal, ProjectSettingsInstallWidget, ProjectSettingsUsersOnboarding, TemplateWrapper } from './dashboard/ProjectSettings';
import WelcomePage from './dashboard/WelcomePage';
import DemoApp, { getProject, Project as DemoProject } from './DemoApp';
import Logo from './Logo';

export const getProjectLink = (config: Pick<AdminClient.Config, 'domain' | 'slug'>): string => {
  return `${windowIso.location.protocol}//${escapeHtml(config.domain) || `${escapeHtml(config.slug)}.${windowIso.location.host}`}`
}

export interface ShowSnackbarProps {
  message: string;
  key?: string;
  variant?: VariantType;
  persist?: boolean;
  actions?: Array<{
    title: string;
    onClick: (close) => void;
  }>,
}
export type ShowSnackbar = (props: ShowSnackbarProps) => void;

export type OpenPost = (postId?: string, redirectPage?: string) => void;

type PreviewState = {
  type: 'create-post',
  draftId?: string
} | {
  type: 'post',
  id: string,
  headerTitle?: string
} | {
  type: 'create-user',
  draftId?: string
} | {
  type: 'user',
  id: string,
};

export interface DashboardPageContext {
  activeProject?: AdminProject;
  sections: Array<Section>;
  isOnboarding?: boolean;
  previewOnClose?: () => void;
  showProjectLink?: boolean;
  showCreateProjectWarning?: boolean;
  showWarning?: string;
  onDndHandled?: OnDndHandled;
};

const SELECTED_PROJECT_ID_LOCALSTORAGE_KEY = 'dashboard-selected-project-id';
const SELECTED_PROJECT_ID_PARAM_NAME = 'projectId';
export const PostPreviewSize: LayoutSize = { breakWidth: 600, flexGrow: 100, maxWidth: 876, scroll: Orientation.Vertical };
export const UserPreviewSize: LayoutSize = { breakWidth: 350, flexGrow: 100, maxWidth: 1024, scroll: Orientation.Vertical };
const ProjectPreviewSize: LayoutSize = { breakWidth: 500, flexGrow: 100, maxWidth: 1024, scroll: Orientation.Vertical };
export const ProjectSettingsMainSize: LayoutSize = { breakWidth: 500, flexGrow: 100, maxWidth: 'max-content', scroll: Orientation.Both };

const styles = (theme: Theme) => createStyles({
  grow: {
    flexGrow: 1,
  },
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
  feedbackViewAndControls: {
    display: 'flex',
    flexDirection: 'column',
  },
  feedbackViewControlIcons: {
    fontSize: '1.5em',
  },
  feedbackViewControls: {
    display: 'flex',
    justifyContent: 'space-between',
  },
  feedbackColumnRelated: {
    flex: '1 1 0px',
    width: 200,
    display: 'flex',
    flexDirection: 'column',
  },
  feedbackNavigatorIcon: {
    fontSize: '2.5em',
  },
  feedbackQuickActionsTopMargin: {
    marginTop: theme.spacing(8),
  },
  roadmapContainer: {
    display: 'flex',
    height: '100%',
  },
  roadmapSectionStack: {
    display: 'flex',
    flexDirection: 'column',
  },
  roadmapSection: {
    display: 'flex',
    flexDirection: 'column',
    ...contentScrollApplyStyles({ theme, orientation: Orientation.Vertical }),
  },
  roadmapSectionTitle: {
    margin: theme.spacing(2, 2, 0),
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
  homeContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
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
  previewShowOnPage?: string;
  publishDialogShown?: boolean;
  publishDialogStep?: number;
  publishDialogSubmitting?: boolean;
  publishDialogInviteMods?: string[];
  dragDropSensorApi?: SensorAPI;
  // Below is state for individual pages
  // It's not very nice to be here in one place, but it does allow for state
  // to persist between page clicks
  settingsPreviewChanges?: 'live' | 'code';
  explorerPostSearch?: AdminClient.IdeaSearchAdmin;
  explorerPreview?: PreviewState,
  feedbackPostSearch?: AdminClient.IdeaSearchAdmin;
  feedbackPreview?: PreviewState,
  feedbackPreviewRight?: PreviewState,
  roadmapPostSearch?: AdminClient.IdeaSearchAdmin;
  roadmapPreview?: PreviewState,
  changelogPostSearch?: AdminClient.IdeaSearchAdmin;
  changelogPreview?: PreviewState,
  usersUserFilter?: Partial<AdminClient.UserSearchAdmin>;
  usersUserSearch?: string;
  usersPreview?: PreviewState,
  postCreateOnLoggedIn?: (userId: string) => void;
  // Below is state for various template options that are updated after publish
  // Null means, we received it, but its not present, undefined means we are still waiting
  landing?: LandingInstance | null;
  feedback?: FeedbackInstance | null;
  roadmap?: RoadmapInstance | null;
  changelog?: ChangelogInstance | null;
}
export class Dashboard extends Component<Props & ConnectProps & RouteComponentProps & WithStyles<typeof styles, true> & WithWidthProps & WithSnackbarProps, State> {
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
  draggingPostIdSubscription = new Subscription<string | undefined>(undefined);
  readonly feedbackListRef = createMutableRef<PanelPostNavigator>();

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
    const projects = Object.keys(this.props.bindByProjectId)
      .map(projectId => ServerAdmin.get().getOrCreateProject(projectId));
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
      templater.feedbackGet().then(i => this.setState({ feedback: i || null })).catch(e => this.setState({ feedback: undefined }));
      templater.roadmapGet().then(i => this.setState({ roadmap: i || null })).catch(e => this.setState({ roadmap: undefined }));
      templater.landingGet().then(i => this.setState({ landing: i || null })).catch(e => this.setState({ landing: undefined }));
      templater.changelogGet().then(i => this.setState({ changelog: i || null })).catch(e => this.setState({ changelog: undefined }));
    }

    const context: DashboardPageContext = {
      activeProject,
      sections: [],
    };
    switch (activePath) {
      case '':
        setTitle('Home - Dashboard');
        context.showProjectLink = true;
        if (!activeProject) {
          context.showCreateProjectWarning = true;
          break;
        }
        context.sections.push({
          name: 'main',
          size: { flexGrow: 1, scroll: Orientation.Vertical },
          collapseTopBottom: true,
          noPaper: true,
          content: (
            <div className={this.props.classes.homeContainer}>
              <Provider key={activeProject.projectId} store={activeProject.server.getStore()}>
                <DashboardHome
                  server={activeProject.server}
                  editor={activeProject.editor}
                  onClickPost={postId => this.pageClicked('post', [postId])}
                  onUserClick={userId => this.pageClicked('user', [userId])}
                  feedback={this.state.feedback || undefined}
                  roadmap={this.state.roadmap || undefined}
                  changelog={this.state.changelog || undefined}
                />
                <Hidden smDown>
                  <TemplateWrapper<[RoadmapInstance | undefined, ChangelogInstance | undefined]>
                    key='roadmap-public'
                    type='dialog'
                    editor={activeProject.editor}
                    mapper={templater => Promise.all([templater.roadmapGet(), templater.changelogGet()])}
                    renderResolved={(templater, [roadmap, changelog]) => !!roadmap?.pageAndIndex?.page.board && (
                      <Provider key={activeProject.projectId} store={activeProject.server.getStore()}>
                        <BoardContainer
                          title={roadmap.pageAndIndex.page.board.title}
                          panels={roadmap.pageAndIndex.page.board.panels.map((panel, panelIndex) => (
                            <BoardPanel
                              server={activeProject.server}
                              panel={panel}
                              PanelPostProps={{
                                onClickPost: postId => this.pageClicked('post', [postId]),
                                onUserClick: userId => this.pageClicked('user', [userId]),
                                selectable: 'highlight',
                                selected: this.state.roadmapPreview?.type === 'post' ? this.state.roadmapPreview.id : undefined,
                              }}
                            />
                          ))}
                        />
                      </Provider>
                    )}
                  />
                </Hidden>
              </Provider>
            </div>
          ),
        });
        break;
      case 'welcome':
        setTitle('Welcome - Dashboard');
        context.isOnboarding = true;
        context.sections.push({
          name: 'main',
          content: (
            <WelcomePage />
          ),
        });
        break;
      case 'created':
        setTitle('Success - Dashboard');
        if (!activeProject) {
          context.showCreateProjectWarning = true;
          break;
        }
        context.sections.push({
          name: 'main',
          content: (
            <Provider key={activeProject.projectId} store={activeProject.server.getStore()}>
              <CreatedPage key={activeProject.server.getProjectId()} server={activeProject.server} />
            </Provider>
          ),
        });
        break;
      case 'explore':
        this.renderExplore(context);
        break;
      case 'feedback':
        this.renderFeedback(context);
        break;
      case 'roadmap':
        this.renderRoadmap(context);
        break;
      case 'changelog':
        this.renderChangelog(context);
        break;
      case 'users':
        this.renderUsers(context);
        break;
      case 'billing':
        context.sections.push({
          name: 'main',
          content: (<RedirectIso to='/dashboard/settings/account/billing' />)
        });
        break;
      case 'account':
        context.sections.push({
          name: 'main',
          content: (<RedirectIso to='/dashboard/settings/account/profile' />)
        });
        break;
      // @ts-ignore fall-through
      case 'welcome-create':
        context.isOnboarding = true;
      case 'create':
        setTitle('Create - Dashboard');
        if (!this.createProjectPromise) {
          this.createProjectPromise = getProject(undefined, undefined, { suppressSetTitle: true });
          this.createProjectPromise.then(project => {
            this.createProject = project;
            this.forceUpdate();
          })
        }
        context.sections.push({
          name: 'main',
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
        });
        context.sections.push(this.renderPreviewCreateDemo());
        break;
      case 'settings':
        this.renderSettings(context);
        break;
      default:
        setTitle('Page not found');
        context.showWarning = 'Oops, cannot find page';
        break;
    }
    if (context.showCreateProjectWarning || context.showWarning) {
      context.sections = [{
        name: 'main',
        content: (<ErrorPage msg={context.showWarning || 'Oops, you have to create a project first'} />),
      }];
      context.showCreateProjectWarning && this.props.history.replace('/dashboard/welcome');
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
    const projectLink = (!!activeProjectConf && !!context.showProjectLink)
      ? getProjectLink(activeProjectConf) : undefined;

    return (
      <Elements stripe={Dashboard.getStripePromise()}>
        {this.props.account && (
          <SubscriptionStatusNotifier account={this.props.account} />
        )}
        <DragDropContext
          enableDefaultSensors
          sensors={[api => {
            if (this.state.dragDropSensorApi !== api) {
              this.setState({ dragDropSensorApi: api });
            }
          }]}
          onBeforeCapture={(before) => {
            if (!activeProject) return;

            const srcPost = activeProject.server.getStore().getState().ideas.byId[before.draggableId]?.idea;
            if (!srcPost) return;

            this.draggingPostIdSubscription.notify(srcPost.ideaId);
          }}
          onDragEnd={(result, provided) => {
            this.draggingPostIdSubscription.notify(undefined);

            if (!result.destination || !activeProject) return;

            dashboardOnDragEnd(
              activeProject,
              result.source.droppableId,
              result.source.index,
              result.draggableId,
              result.destination.droppableId,
              result.destination.index,
              this.state.feedback || undefined,
              this.state.roadmap || undefined,
              context.onDndHandled);
          }}
        >
          <Layout
            toolbarShow={!context.isOnboarding}
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
            previewShow={!!this.state.previewShowOnPage && this.state.previewShowOnPage === activePath}
            previewShowNot={() => {
              this.setState({ previewShowOnPage: undefined });
              context.previewOnClose?.();
            }}
            previewForceShowClose={!!context.previewOnClose}
            sections={context.sections}
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

  renderExplore = renderExplore;
  renderFeedback = renderFeedback;
  renderRoadmap = renderRoadmap;
  renderChangelog = renderChangelog;
  renderUsers = renderUsers;
  renderSettings = renderSettings;

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

  renderPreview(preview: {
    project?: AdminProject
    stateKey: keyof State,
    renderEmpty?: string,
    extra?: Partial<Section> | ((previewState: PreviewState | undefined) => Partial<Section>),
    createCategoryIds?: string[],
    createAllowDrafts?: boolean,
  }): Section | null {
    if (!preview.project) {
      return preview.renderEmpty ? this.renderPreviewEmpty('No project selected') : null;
    }
    const previewState = this.state[preview.stateKey] as PreviewState | undefined;
    var section;
    if (!previewState) {
      section = preview.renderEmpty !== undefined ? this.renderPreviewEmpty(preview.renderEmpty) : null;
    } else if (previewState.type === 'create-post') {
      section = this.renderPreviewPostCreate(preview.stateKey, preview.project, previewState.draftId, preview.createCategoryIds, preview.createAllowDrafts);
    } else if (previewState.type === 'post') {
      section = this.renderPreviewPost(previewState.id, preview.project, previewState.headerTitle);
    } else if (previewState.type === 'create-user') {
      section = this.renderPreviewUserCreate(preview.project);
    } else if (previewState.type === 'user') {
      section = this.renderPreviewUser(previewState.id, preview.project);
    }
    if (section && preview.extra) {
      section = {
        ...section,
        ...(typeof preview.extra === 'function' ? preview.extra(previewState) : preview.extra),
      };
    }
    return section;
  }

  renderPreviewPost(postId: string, project: AdminProject, headerTitle?: string): Section {
    return {
      name: 'preview',
      breakAction: 'drawer',
      size: PostPreviewSize,
      ...(headerTitle ? {
        header: { title: { title: headerTitle } },
      } : {}),
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

  renderPreviewUser(userId: string, project?: AdminProject): Section {
    if (!project) {
      return this.renderPreviewEmpty('No project selected');
    }
    return {
      name: 'preview',
      breakAction: 'drawer',
      size: UserPreviewSize,
      content: (
        <Provider key={project.projectId} store={project.server.getStore()}>
          <UserPage key={userId} server={project.server} userId={userId} />
        </Provider>
      ),
    };
  }

  renderPreviewPostCreate(
    stateKey: string,
    project?: AdminProject,
    draftId?: string,
    mandatoryCategoryIds?: string[],
    allowDrafts?: boolean,
  ): Section {
    if (!project) {
      return this.renderPreviewEmpty('No project selected');
    }
    return {
      name: 'preview',
      breakAction: 'drawer',
      size: PostPreviewSize,
      content: (
        <Provider key={project.projectId} store={project.server.getStore()}>
          <PostCreateForm
            key={draftId || 'new'}
            server={project.server}
            type='post'
            mandatoryCategoryIds={mandatoryCategoryIds}
            adminControlsDefaultVisibility='expanded'
            logInAndGetUserId={() => new Promise<string>(resolve => this.setState({ postCreateOnLoggedIn: resolve }))}
            draftId={draftId}
            onCreated={postId => {
              this.setState({ [stateKey]: { type: 'post', id: postId } as PreviewState } as any);
            }}
            onDraftCreated={allowDrafts ? draft => {
              this.setState({ [stateKey]: { type: 'create-post', draftId: draft.draftId } as PreviewState } as any);
            } : undefined}
            onDiscarded={(allowDrafts || !!draftId) ? () => {
              this.setState({ [stateKey]: undefined } as any);
            } : undefined}
          />
          <LogIn
            actionTitle='Get notified of replies'
            server={project.server}
            open={!!this.state.postCreateOnLoggedIn}
            onClose={() => this.setState({ postCreateOnLoggedIn: undefined })}
            onLoggedInAndClose={userId => {
              if (this.state.postCreateOnLoggedIn) {
                this.state.postCreateOnLoggedIn(userId);
                this.setState({ postCreateOnLoggedIn: undefined });
              }
            }}
          />
        </Provider>
      ),
    };
  }

  renderPreviewUserCreate(project?: AdminProject): Section {
    if (!project) {
      return this.renderPreviewEmpty('No project selected');
    }
    return {
      name: 'preview',
      breakAction: 'drawer',
      size: UserPreviewSize,
      content: (
        <div>
          TODO user create
        </div>
      ),
    };
  }

  renderPreviewCreateDemo(): Section {
    return {
      name: 'preview',
      breakAction: 'drawer',
      size: {},
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

  renderPreviewChangesDemo(project?: AdminProject, allowCode?: boolean, showCodeForProject?: AdminProject): Section {
    if (!project) {
      return this.renderPreviewEmpty('No project selected');
    }
    return {
      name: 'preview',
      breakAction: 'drawer',
      size: ProjectPreviewSize,
      content: (
        <>
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
          <Divider />
          {!showCodeForProject ? (
            <DemoApp
              key={project.configVersion}
              server={project.server}
              settings={{ suppressSetTitle: true }}
              forcePathSubscribe={listener => this.forcePathListener = listener}
            />
          ) : (
            <ConfigView server={showCodeForProject.server} editor={showCodeForProject.editor} />
          )}
        </>
      ),
    };
  }

  renderPreviewEmpty(msg: string, size?: LayoutSize): Section {
    return {
      name: 'preview',
      breakAction: 'drawer',
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

  openPost(postId?: string, redirectPage?: string) {
    this.pageClicked('post', [postId || '', redirectPage || '']);
  }

  pageClicked(path: string, subPath: ConfigEditor.Path = []): void {
    if (path === 'post') {
      // For post, expected parameters for subPath are:
      // 0: postId or null for create
      // 1: page to redirect to
      const postId = !!subPath[0] ? (subPath[0] + '') : undefined;
      const redirectPath = subPath[1];
      const redirect = !!redirectPath ? () => this.props.history.push('/dashboard/' + redirectPath) : undefined;
      const activePath = redirectPath || this.props.match.params['path'] || '';
      const preview: State['explorerPreview'] & State['feedbackPreview'] & State['roadmapPreview'] = !!postId
        ? { type: 'post', id: postId }
        : { type: 'create-post' };
      if (activePath === 'feedback') {
        this.setState({
          // previewShowOnPage: 'feedback', // Always shown 
          feedbackPreview: preview,
        }, redirect);
      } else if (activePath === 'explore') {
        this.setState({
          previewShowOnPage: 'explore',
          explorerPreview: preview,
        }, redirect);
      } else if (activePath === 'roadmap') {
        this.setState({
          previewShowOnPage: 'roadmap',
          roadmapPreview: preview,
        }, redirect);
      } else if (activePath === 'changelog') {
        this.setState({
          previewShowOnPage: 'changelog',
          changelogPreview: preview,
        }, redirect);
      } else {
        this.setState({
          previewShowOnPage: 'explore',
          explorerPreview: preview,
        }, () => this.props.history.push('/dashboard/explore'));
      }
    } else if (path === 'user') {
      this.setState({
        previewShowOnPage: 'users',
        usersPreview: !!subPath[0]
          ? { type: 'user', id: subPath[0] + '' }
          : { type: 'create-user' },
      }, () => this.props.history.push('/dashboard/users'));
    } else {
      this.props.history.push(`/dashboard/${[path, ...subPath].join('/')}`);
    }
  }

  showSnackbar(props: ShowSnackbarProps) {
    this.props.enqueueSnackbar(props.message, {
      key: props.key,
      variant: props.variant,
      persist: props.persist,
      action: !props.actions?.length ? undefined : (key) => (
        <>
          {props.actions?.map(action => (
            <Button
              color='inherit'
              onClick={() => action.onClick(() => this.props.closeSnackbar(key))}
            >{action.title}</Button>
          ))}
        </>
      ),
    });
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
}, null, null, { forwardRef: true })(withStyles(styles, { withTheme: true })(withWidth({ initialWidth })(withSnackbar(Dashboard))));
