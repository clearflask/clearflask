// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { Button, Divider, Fade, IconButton, SvgIconTypeMap, Tab, Tabs, Typography, withWidth, WithWidthProps } from '@material-ui/core';
import { OverridableComponent } from '@material-ui/core/OverridableComponent';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import AccountIcon from '@material-ui/icons/AccountCircle';
import AddIcon from '@material-ui/icons/Add';
import EmptyIcon from '@material-ui/icons/BlurOn';
import CheckIcon from '@material-ui/icons/Check';
import CodeIcon from '@material-ui/icons/Code';
import SettingsIcon from '@material-ui/icons/Settings';
import SuperAccountIcon from '@material-ui/icons/SupervisedUserCircle';
import VisibilityIcon from '@material-ui/icons/Visibility';
import { Elements } from '@stripe/react-stripe-js';
import { Stripe } from '@stripe/stripe-js';
import { loadStripe } from '@stripe/stripe-js/pure';
import { VariantType, withSnackbar, WithSnackbarProps } from 'notistack';
import React, { Component } from 'react';
import { DragDropContext, SensorAPI } from 'react-beautiful-dnd';
import { withTranslation, WithTranslation } from 'react-i18next';
import { connect, Provider } from 'react-redux';
import { Redirect, RouteComponentProps } from 'react-router';
import { Link } from 'react-router-dom';
import * as AdminClient from '../api/admin';
import { Status } from '../api/server';
import ServerAdmin, { Project as AdminProject, ReduxStateAdmin } from '../api/serverAdmin';
import { SSO_TOKEN_PARAM_NAME } from '../app/App';
import LogIn from '../app/comps/LogIn';
import { PanelPostNavigator } from '../app/comps/PanelPost';
import PostCreateForm, { ExternalControl } from '../app/comps/PostCreateForm';
import { Label } from '../app/comps/SelectionPicker';
import UserPage from '../app/comps/UserPage';
import ErrorPage from '../app/ErrorPage';
import LoadingPage from '../app/LoadingPage';
import SubscriptionStatusNotifier from '../app/utils/SubscriptionStatusNotifier';
import ClearFlaskTourProvider, { tourSetGuideState } from '../common/ClearFlaskTourProvider';
import * as ConfigEditor from '../common/config/configEditor';
import Templater from '../common/config/configTemplater';
import ConfigView from '../common/config/settings/ConfigView';
import { TeammatePlanId } from '../common/config/settings/UpgradeWrapper';
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
import { TourChecklist, TourDefinitionGuideState } from '../common/tour';
import { detectEnv, Environment, isProd } from '../common/util/detectEnv';
import { escapeHtml } from '../common/util/htmlUtil';
import { createMutableRef, MutableRef } from '../common/util/refUtil';
import { RedirectIso, redirectIso } from '../common/util/routerUtil';
import { initialWidth } from '../common/util/screenUtil';
import Subscription from '../common/util/subscriptionUtil';
import setTitle from '../common/util/titleUtil';
import windowIso from '../common/windowIso';
import { LanguageSelect } from '../LanguageSelect';
import { ADMIN_LOGIN_REDIRECT_TO } from './AccountEnterPage';
import ContactPage from './ContactPage';
import { BillingPaymentActionRedirect, BillingPaymentActionRedirectPath } from './dashboard/BillingPage';
import CreatePage from './dashboard/CreatePage';
import { renderChangelog } from './dashboard/dashboardChangelog';
import { dashboardOnDragEnd, OnDndHandled, OnDndPreHandling } from './dashboard/dashboardDndActionHandler';
import { renderExplore } from './dashboard/dashboardExplore';
import { renderFeedback } from './dashboard/dashboardFeedback';
import DashboardHome from './dashboard/DashboardHome';
import DashboardPost from './dashboard/DashboardPost';
import { renderRoadmap } from './dashboard/dashboardRoadmap';
import { renderSettings } from './dashboard/dashboardSettings';
import { renderUsers } from './dashboard/dashboardUsers';
import DemoApp from './DemoApp';
import { LandingEmbedFeedbackPage } from './LandingPages';
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
  draftId?: string,
  defaultStatusId?: string,
} | {
  type: 'post',
  id: string,
  headerIcon?: OverridableComponent<SvgIconTypeMap>,
  headerTitle?: string,
} | {
  type: 'create-user',
  draftId?: string,
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
  onDndPreHandling?: OnDndPreHandling;
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
  roadmapTaskSection: {
    display: 'flex',
    flexDirection: 'column',
  },
  roadmapTaskList: {
    flex: '1 1 0px',
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
  headerAction: {
    alignSelf: 'center',
    marginRight: theme.spacing(4),
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
  selectedProjectId?: string;
  previewShowOnPage?: string;
  saveIsSubmitting?: boolean;
  saveDiscardDialogOpen?: boolean;
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
  hasUncategorizedCategories?: boolean;
}
export class Dashboard extends Component<Props & ConnectProps & WithTranslation<'site'> & RouteComponentProps & WithStyles<typeof styles, true> & WithWidthProps & WithSnackbarProps, State> {
  static stripePromise: Promise<Stripe | null> | undefined;
  unsubscribes: { [projectId: string]: () => void } = {};
  forcePathListener: ((forcePath: string) => void) | undefined;
  lastConfigVer?: string;
  similarPostWasClicked?: {
    originalPostId: string;
    similarPostId: string;
  };
  draggingPostIdSubscription = new Subscription<string | undefined>(undefined);
  readonly feedbackListRef = createMutableRef<PanelPostNavigator>();
  readonly changelogPostDraftExternalControlRef = createMutableRef<ExternalControl>();
  state: State = {};

  constructor(props) {
    super(props);

    Dashboard.getStripePromise();
  }

  componentDidMount() {
    if (this.props.accountStatus === undefined) {
      this.bind();
    } else if (!this.props.configsStatus) {
      ServerAdmin.get().dispatchAdmin().then(d => d.configGetAllAndUserBindAllAdmin());
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
        : 'pk_test_51Dfi5vAl0n0hFnHPXRnnJdMKRKF6MMOWLQBwLl1ifwPZysg1wJNtYcumjgO8oPHlqITK2dXWlbwLEsPYas6jpUkY00Ryy3AtGP');
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
      const result = await dispatcher.accountBindAdmin({ accountBindAdmin: {} });
      if (result.account) {
        await dispatcher.configGetAllAndUserBindAllAdmin();
      }
      this.forceUpdate();
    } catch (er) {
      this.forceUpdate();
      throw er;
    }
  }

  componentWillUnmount() {
    Object.values(this.unsubscribes).forEach(unsubscribe => unsubscribe());
  }

  render() {
    if (this.props.accountStatus === Status.FULFILLED && !this.props.account) {
      return (<Redirect to={{
        pathname: '/login',
        state: { [ADMIN_LOGIN_REDIRECT_TO]: this.props.location.pathname }
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
      .filter(projectId => !projectId.startsWith('demo-'))
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

    if (activeProject && this.lastConfigVer !== activeProject.configVersion) {
      this.lastConfigVer = activeProject.configVersion;
      const templater = Templater.get(activeProject.editor);
      const feedbackPromise = templater.feedbackGet();
      const roadmapPromise = templater.roadmapGet();
      const landingPromise = templater.landingGet();
      const changelogPromise = templater.changelogGet();
      feedbackPromise
        .then(i => this.setState({ feedback: i || null }))
        .catch(e => this.setState({ feedback: undefined }));
      roadmapPromise
        .then(i => this.setState({ roadmap: i || null }))
        .catch(e => this.setState({ roadmap: undefined }));
      landingPromise
        .then(i => this.setState({ landing: i || null }))
        .catch(e => this.setState({ landing: undefined }));
      changelogPromise
        .then(i => this.setState({ changelog: i || null }))
        .catch(e => this.setState({ changelog: undefined }));

      const allPromise = Promise.all([feedbackPromise, roadmapPromise, changelogPromise]);
      allPromise
        .then(all => {
          const hasUncategorizedCategories = !activeProject.editor.getConfig().content.categories.every(category =>
            category.categoryId === all[0]?.categoryAndIndex.category.categoryId
            || category.categoryId === all[1]?.categoryAndIndex.category.categoryId
            || category.categoryId === all[2]?.categoryAndIndex.category.categoryId
          );
          this.setState({ hasUncategorizedCategories });
        })
        .catch(e => this.setState({ hasUncategorizedCategories: true }));
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
                  feedback={this.state.feedback || undefined}
                  roadmap={this.state.roadmap || undefined}
                  changelog={this.state.changelog || undefined}
                />
              </Provider>
              <Provider store={ServerAdmin.get().getStore()}>
                <TourChecklist />
              </Provider>
              {/* <Hidden smDown>
                <Provider key={activeProject.projectId} store={activeProject.server.getStore()}>
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
                </Provider>
              </Hidden> */}
            </div>
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
      case 'welcome':
      case 'create':
        context.showProjectLink = true;
        const isOnboarding = activePath === 'welcome'
          && this.props.account?.basePlanId !== TeammatePlanId;
        if (isOnboarding) {
          context.isOnboarding = true;
          setTitle('Welcome');
        } else {
          setTitle('Create a project - Dashboard');
        }
        context.sections.push({
          name: 'main',
          noPaper: true, collapseTopBottom: true, collapseLeft: true, collapseRight: true,
          size: { flexGrow: 1, breakWidth: 300, scroll: Orientation.Vertical },
          content: (
            <CreatePage
              isOnboarding={isOnboarding}
              projectCreated={(projectId) => {
                this.setSelectedProjectId(projectId);
              }}
            />
          ),
        });
        break;
      case 'settings':
        this.renderSettings(context);
        break;
      case 'contact':
        context.sections.push({
          name: 'main',
          noPaper: true,
          collapseTopBottom: true, collapseLeft: true, collapseRight: true,
          size: { flexGrow: 1, breakWidth: 300, scroll: Orientation.Vertical },
          content: (<ContactPage />)
        });
        break;
      case 'e':
        context.sections.push({
          name: 'main',
          noPaper: true,
          collapseTopBottom: true, collapseLeft: true, collapseRight: true,
          size: { flexGrow: 1, breakWidth: 300, scroll: Orientation.Vertical },
          content: (<LandingEmbedFeedbackPage browserPathPrefix='/dashboard/e' embed />)
        });
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

    const activeProjectConf = activeProject?.server.getStore().getState().conf.conf;
    const projectLink = (!!activeProjectConf && !!context.showProjectLink)
      ? getProjectLink(activeProjectConf) : undefined;

    var content = (
      <>
        {this.props.account && (
          <SubscriptionStatusNotifier account={this.props.account} />
        )}
        <Layout
          toolbarShow={!context.isOnboarding}
          toolbarLeft={(
            <div className={this.props.classes.toolbarLeft}>
              <Tabs
                className={this.props.classes.tabs}
                variant='standard'
                scrollButtons='off'
                classes={{
                  indicator: this.props.classes.tabsIndicator,
                  flexContainer: this.props.classes.tabsFlexContainer,
                }}
                value={activePath || 'home'}
                indicatorColor="primary"
                textColor="primary"
              >
                <Tab
                  className={this.props.classes.tab}
                  component={Link}
                  to='/dashboard'
                  value='home'
                  disableRipple
                  label={(<Logo suppressMargins />)}
                  classes={{
                    root: this.props.classes.tabRoot,
                  }}
                />
                {!!this.state.hasUncategorizedCategories && (
                  <Tab
                    className={this.props.classes.tab}
                    component={Link}
                    to='/dashboard/explore'
                    value='explore'
                    disableRipple
                    label={this.props.t('explore')}
                    classes={{
                      root: this.props.classes.tabRoot,
                    }}
                  />
                )}
                {this.state.feedback !== null && (
                  <Tab
                    className={this.props.classes.tab}
                    component={Link}
                    to='/dashboard/feedback'
                    value='feedback'
                    disableRipple
                    label={this.props.t('feedback')}
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
                    label={this.props.t('roadmap')}
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
                    label={this.props.t('announcements')}
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
                  label={this.props.t('users')}
                  classes={{
                    root: this.props.classes.tabRoot,
                  }}
                />
              </Tabs>
            </div>
          )}
          toolbarRight={
            <>
              <LanguageSelect />
              <MenuItems
                items={[
                  ...(!!projectLink ? [{
                    type: 'button' as 'button', tourAnchorProps: {
                      anchorId: 'dashboard-visit-portal', placement: 'bottom' as 'bottom',
                    }, onClick: () => {
                      !windowIso.isSsr && windowIso.open(projectLink, '_blank');
                      tourSetGuideState('visit-project', TourDefinitionGuideState.Completed);
                    }, title: this.props.t('visit'), icon: VisitIcon
                  }] : []),
                  {
                    type: 'dropdown', title: (!!activeProject && projects.length > 1) ? activeProject.editor.getConfig().name : this.props.account.name,
                    color: 'primary', items: [
                      ...(projects.map(p => ({
                        type: 'button' as 'button', onClick: () => this.setSelectedProjectId(p.projectId), title: p.editor.getConfig().name || p.editor.getConfig().slug || p.editor.getConfig().domain || p.editor.getConfig().projectId || 'Unnamed project',

                        icon: p.projectId === activeProjectId ? CheckIcon : undefined
                      }))),
                      { type: 'divider' },
                      { type: 'button', link: '/dashboard/create', title: this.props.t('add-project'), icon: AddIcon },
                      { type: 'button', link: '/dashboard/settings/project/branding', title: this.props.t('settings'), icon: SettingsIcon },
                      { type: 'divider' },
                      // { type: 'button', link: this.openFeedbackUrl('docs'), linkIsExternal: true, title: 'Documentation' },
                      { type: 'button', link: '/dashboard/contact', title: this.props.t('contact') },
                      { type: 'button', link: '/dashboard/e/feedback', title: this.props.t('give-feedback') },
                      { type: 'button', link: '/dashboard/e/roadmap', title: this.props.t('our-roadmap') },
                      { type: 'divider' },
                      { type: 'button', link: '/dashboard/settings/account/profile', title: this.props.t('account'), icon: AccountIcon },
                      ...(!!this.props.isSuperAdmin && detectEnv() !== Environment.PRODUCTION_SELF_HOST ? [
                        { type: 'button' as 'button', link: '/dashboard/settings/super/loginas', title: 'Super Admin', icon: SuperAccountIcon },
                      ] : []),
                      {
                        type: 'button', onClick: () => {
                          ServerAdmin.get().dispatchAdmin().then(d => d.accountLogoutAdmin());
                          redirectIso('/login', this.props.history);
                        }, title: this.props.t('sign-out'), icon: LogoutIcon
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
      </>
    );

    content = (
      <Elements stripe={Dashboard.getStripePromise()}>
        {content}
      </Elements>
    );

    content = (
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
            context.onDndHandled,
            context.onDndPreHandling);
        }}
      >
        {content}
      </DragDropContext>
    );

    content = (
      <ClearFlaskTourProvider
        feedback={this.state.feedback || undefined}
        roadmap={this.state.roadmap || undefined}
        changelog={this.state.changelog || undefined}
      >
        {content}
      </ClearFlaskTourProvider>
    );

    return content;
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
    postDraftExternalControlRef?: MutableRef<ExternalControl>;
  }): Section | null {
    if (!preview.project) {
      return preview.renderEmpty ? this.renderPreviewEmpty('No project selected') : null;
    }
    const previewState = this.state[preview.stateKey] as PreviewState | undefined;
    var section;
    if (!previewState) {
      section = preview.renderEmpty !== undefined ? this.renderPreviewEmpty(preview.renderEmpty) : null;
    } else if (previewState.type === 'create-post') {
      section = this.renderPreviewPostCreate(preview.stateKey, preview.project, previewState.draftId, preview.createCategoryIds, preview.createAllowDrafts, previewState.defaultStatusId, preview.postDraftExternalControlRef);
    } else if (previewState.type === 'post') {
      section = this.renderPreviewPost(previewState.id, preview.stateKey, preview.project, previewState.headerTitle, previewState.headerIcon);
    } else if (previewState.type === 'create-user') {
      section = this.renderPreviewUserCreate(preview.stateKey, preview.project);
    } else if (previewState.type === 'user') {
      section = this.renderPreviewUser(previewState.id, preview.stateKey, preview.project);
    }
    if (section && preview.extra) {
      section = {
        ...section,
        ...(typeof preview.extra === 'function' ? preview.extra(previewState) : preview.extra),
      };
    }
    return section;
  }

  renderPreviewPost(postId: string, stateKey: keyof State, project: AdminProject, headerTitle?: string, headerIcon?: OverridableComponent<SvgIconTypeMap>): Section {
    return {
      name: 'preview',
      breakAction: 'drawer',
      size: PostPreviewSize,
      ...(headerTitle ? {
        header: { title: { title: headerTitle, icon: headerIcon } },
      } : {}),
      content: (
        <Provider key={project.projectId} store={project.server.getStore()}>
          <Fade key={postId} in appear>
            <div>
              <DashboardPost
                key={postId}
                server={project.server}
                postId={postId}
                onClickPost={postId => this.pageClicked('post', [postId])}
                onUserClick={userId => this.pageClicked('user', [userId])}
                onDeleted={() => this.setState({ [stateKey]: undefined } as any)}
              />
            </div>
          </Fade>
        </Provider>
      ),
    };
  }

  renderPreviewUser(userId: string, stateKey: string, project?: AdminProject): Section {
    if (!project) {
      return this.renderPreviewEmpty('No project selected');
    }
    return {
      name: 'preview',
      breakAction: 'drawer',
      size: UserPreviewSize,
      content: (
        <Provider key={project.projectId} store={project.server.getStore()}>
          <Fade key={userId} in appear>
            <div>
              <UserPage
                key={userId}
                server={project.server}
                userId={userId}
                suppressSignOut
                onDeleted={() => this.setState({ [stateKey]: undefined } as any)}
              />
            </div>
          </Fade>
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
    defaultStatusId?: string,
    externalControlRef?: MutableRef<ExternalControl>,
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
          <Fade key='post-create' in appear>
            <div>
              <PostCreateForm
                key={draftId || 'new'}
                server={project.server}
                type='post'
                mandatoryCategoryIds={mandatoryCategoryIds}
                adminControlsDefaultVisibility='expanded'
                logInAndGetUserId={() => new Promise<string>(resolve => this.setState({ postCreateOnLoggedIn: resolve }))}
                draftId={draftId}
                defaultStatusId={defaultStatusId}
                defaultConnectSearch={(stateKey === 'changelogPreview' && this.state.roadmap) ? {
                  filterCategoryIds: [this.state.roadmap.categoryAndIndex.category.categoryId],
                  filterStatusIds: this.state.roadmap.statusIdCompleted ? [this.state.roadmap.statusIdCompleted] : undefined,
                } : undefined}
                onCreated={postId => {
                  this.setState({ [stateKey]: { type: 'post', id: postId } as PreviewState } as any);
                }}
                onDraftCreated={allowDrafts ? draft => {
                  this.setState({ [stateKey]: { type: 'create-post', draftId: draft.draftId } as PreviewState } as any);
                } : undefined}
                onDiscarded={() => {
                  this.setState({ [stateKey]: undefined } as any);
                }}
                externalControlRef={externalControlRef}
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
            </div>
          </Fade>
        </Provider>
      ),
    };
  }

  renderPreviewUserCreate(stateKey: keyof State, project?: AdminProject): Section {
    if (!project) {
      return this.renderPreviewEmpty('No project selected');
    }
    return {
      name: 'preview',
      breakAction: 'drawer',
      size: UserPreviewSize,
      content: (
        <Provider key={project.projectId} store={project.server.getStore()}>
          <Fade key='user-create' in appear>
            <div>
              <UserPage
                server={project.server}
                suppressSignOut
                onDeleted={() => this.setState({ [stateKey]: undefined } as any)}
              />
            </div>
          </Fade>
        </Provider>
      ),
    };
  }

  renderPreviewChangesDemo(project?: AdminProject, showCodeForProject?: boolean): Section {
    if (!project) {
      return this.renderPreviewEmpty('No project selected');
    }
    return {
      name: 'preview',
      breakAction: 'drawer',
      size: ProjectPreviewSize,
      content: (
        <>
          <div style={{ display: 'flex', alignItems: 'center', margin: 4, }}>
            <IconButton onClick={() => this.setState({
              settingsPreviewChanges: !!showCodeForProject ? 'live' : 'code',
            })}>
              {!!showCodeForProject ? <CodeIcon /> : <VisibilityIcon />}
            </IconButton>
            {!!showCodeForProject ? 'Previewing configuration details' : 'Previewing changes with live data'}
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
            <ConfigView
              key={project.projectId}
              server={project.server}
              editor={project.editor}
            />
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
        <Fade key={msg} in appear>
          <div className={this.props.classes.previewEmptyMessage}>
            <Typography component='div' variant='h5'>
              {msg}
            </Typography>
            <EmptyIcon
              fontSize='inherit'
              className={this.props.classes.previewEmptyIcon}
            />
          </div>
        </Fade>
      ),
    };
  }

  openFeedbackUrl(page?: string) {
    var url = `${windowIso.location.protocol}//product.${windowIso.location.host}/${page || ''}`;
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

  setSelectedProjectId(selectedProjectId: string) {
    if (this.state.selectedProjectId === selectedProjectId) return;

    localStorage.setItem(SELECTED_PROJECT_ID_LOCALSTORAGE_KEY, selectedProjectId);
    this.setState(prevState => ({
      ...(Object.keys(prevState).reduce((s, key) => ({ ...s, [key]: undefined }), {})),
      selectedProjectId,
    }));
    this.props.history.push('/dashboard');
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
}, null, null, { forwardRef: true })(withStyles(styles, { withTheme: true })(withWidth({ initialWidth })(withSnackbar(withTranslation('site', { withRef: true })(Dashboard)))));
