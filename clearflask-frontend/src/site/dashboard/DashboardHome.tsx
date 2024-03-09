// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { withWidth, WithWidth } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import AllIdeasIcon from '@material-ui/icons/AllInclusive';
import DiscussionIcon from '@material-ui/icons/ChatBubbleOutlined';
import OpenIdeasIcon from '@material-ui/icons/FeedbackOutlined';
import UsersIcon from '@material-ui/icons/PersonAdd';
import moment from 'moment';
import React, { Component } from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';
import { connect, Provider } from 'react-redux';
import { RouteComponentProps, withRouter } from 'react-router';
import * as Admin from '../../api/admin';
import * as Client from '../../api/client';
import { ReduxState, Server } from '../../api/server';
import * as ConfigEditor from '../../common/config/configEditor';
import { ChangelogInstance } from '../../common/config/template/changelog';
import { FeedbackInstance } from '../../common/config/template/feedback';
import { RoadmapInstance } from '../../common/config/template/roadmap';
import { contentScrollApplyStyles, Orientation } from '../../common/ContentScroll';
import { initialWidth } from '../../common/util/screenUtil';
import Histogram from './Histogram';
import DashboardHomeBox from './DashboardHomeBox';
import WorkflowPreview from '../../common/config/settings/injects/WorkflowPreview';
import classNames from 'classnames';
import DashboardHomePostList from './DashboardHomePostList';
import DashboardHomeUserList from './DashboardHomeUserList';
import ServerAdmin from '../../api/serverAdmin';
import { TourChecklist } from '../../common/tour';

const statePrefixAggregate = 'aggr-';

const styles = (theme: Theme) => createStyles({
  page: {},
  sections: {
    display: 'inline-flex',
    width: 'fit-content',
    flexWrap: 'wrap',
  },
  boardContainer: {
    width: 'max-content',
    margin: 'auto',
  },
  board: {
    display: 'flex',
    flexWrap: 'wrap',
  },
  boardPanel: {
    flex: '1 1 100px',
    paddingTop: theme.spacing(2),
    paddingLeft: theme.spacing(2),
  },
  search: {
    marginBottom: -1,
  },
  expandSwitch: {
    marginLeft: theme.spacing(2),
  },
  expandSwitchLabel: {
    color: theme.palette.text.secondary,
    marginBottom: -20,
  },
  categoryStats: {
    margin: theme.spacing(4, 0),
  },
  users: {
    margin: theme.spacing(4, 0),
    flexShrink: 0,
  },
  userExplorer: {
    paddingTop: theme.spacing(2),
    paddingLeft: theme.spacing(2),
  },
  spacer: {
    width: theme.spacing(2),
    flexShrink: 0,
  },
  title: {
    margin: theme.spacing(1),
    color: theme.palette.text.secondary,
  },
  resultsContainer: {
    display: 'inline-flex',
    flexWrap: 'wrap',
  },
  resultsItem: {
    margin: theme.spacing(2, 6),
  },
  resultsItemInner: {
    padding: theme.spacing(4),
  },
  bigValue: {
    fontSize: '3em',
  },
  stats: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  stat: {},
  postLists: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  scrollVertical: {
    ...contentScrollApplyStyles({ theme, orientation: Orientation.Horizontal }),
  },
  tourChecklistContainer: {
    display: 'flex',
    justifyContent: 'center',
  },
});

interface Props {
  server: Server;
  editor: ConfigEditor.Editor;
  onPageClick: (path: string, subPath?: ConfigEditor.Path) => void;
  feedback?: FeedbackInstance;
  roadmap?: RoadmapInstance;
  changelog?: ChangelogInstance;
}

interface ConnectProps {
  callOnMount?: () => void,
  configver?: string;
  config?: Client.Config;
  loggedInUserId?: string;
}

interface State {
  // State contains dynamic entries for aggregation
}

class DashboardHome extends Component<Props & ConnectProps & WithTranslation<'site'> & WithStyles<typeof styles, true> & RouteComponentProps & WithWidth, State> {
  state: State = {};
  readonly dispatchedCategoryAggregateForIds = new Set<string>();

  constructor(props) {
    super(props);

    props.callOnMount?.();
  }

  getAggregate(categoryId: string): Admin.IdeaAggregateResponse | undefined {
    if (!this.dispatchedCategoryAggregateForIds.has(categoryId)) {
      this.dispatchedCategoryAggregateForIds.add(categoryId);
      this.props.server.dispatchAdmin()
        .then(d => d.ideaCategoryAggregateAdmin({
          projectId: this.props.server.getProjectId(),
          categoryId: categoryId,
        })).then(results => this.setState({
        [statePrefixAggregate + categoryId]: results,
      }));
    }
    return this.state[statePrefixAggregate + categoryId] as Admin.IdeaAggregateResponse | undefined;
  }

  render() {
    const chartWidth = 100;
    const chartHeight = 50;
    const chartXAxis = {
      min: moment().subtract(7, 'd').toDate(),
      max: new Date(),
    };

    // Workflow previews
    const workflows = this.props.config?.content.categories
      .filter(category => !!category.workflow.statuses.length)
      .map((category, index) => ({
        categoryId: category.categoryId,
        categoryIndex: index,
        name: category.name,
        aggregate: this.getAggregate(category.categoryId),
      }));
    const workflowPreviewRenderAggregateLabel = (aggr: Admin.IdeaAggregateResponse) => (statusId: string | 'total', name: string) => `${name} (${statusId === 'total' ? aggr.total : aggr.statuses[statusId] || 0})`;
    const workflowPreviewDimensions = { width: 700, height: 200 };
    const feedbackAggregate = this.props.feedback && workflows?.find(w => w.categoryId === this.props.feedback?.categoryAndIndex.category.categoryId)?.aggregate;

    return (
      <div className={this.props.classes.page}>
        <div className={this.props.classes.stats}>
          <div className={this.props.classes.stats}>
            {!!this.props.feedback && !!feedbackAggregate && (
              <Histogram
                key="Open feedback"
                icon={OpenIdeasIcon}
                title={this.props.t('open-feedback')}
                server={this.props.server}
                className={this.props.classes.stat}
                chartWidth={chartWidth}
                chartHeight={chartHeight}
                xAxis={chartXAxis}
                search={d => d.ideaHistogramAdmin({
                  projectId: this.props.server.getProjectId(),
                  ideaHistogramSearchAdmin: {
                    interval: Admin.HistogramInterval.DAY,
                    filterCreatedStart: moment().subtract(7, 'd').toDate(),
                    filterCategoryIds: [this.props.feedback!.categoryAndIndex.category.categoryId],
                  },
                })}
                overrideValue={!!feedbackAggregate
                  // Filter out for only initial feedback status, typically 'New'
                  ? (feedbackAggregate.statuses[this.props.feedback!.categoryAndIndex.category.workflow.entryStatus || ''] || 0)
                  // Wait for the aggregate call to finish
                  : ''}
              />
            )}
            {!!this.props.roadmap?.statusIdCompleted && (
              <Histogram
                key="Completed Tasks"
                icon={AllIdeasIcon}
                title={this.props.t('completed-tasks')}
                server={this.props.server}
                className={this.props.classes.stat}
                chartWidth={chartWidth}
                chartHeight={chartHeight}
                xAxis={chartXAxis}
                search={d => d.ideaHistogramAdmin({
                  projectId: this.props.server.getProjectId(),
                  ideaHistogramSearchAdmin: {
                    filterCategoryIds: [this.props.roadmap!.categoryAndIndex.category.categoryId],
                    filterStatusIds: [this.props.roadmap!.statusIdCompleted!],
                    interval: Admin.HistogramInterval.DAY,
                    filterCreatedStart: moment().subtract(7, 'd').toDate(),
                  },
                })}
              />
            )}
          </div>
          <div className={this.props.classes.stats}>
            <Histogram
              key="Identified Users"
              icon={UsersIcon}
              title={this.props.t('identified-users')}
              server={this.props.server}
              className={this.props.classes.stat}
              chartWidth={chartWidth}
              chartHeight={chartHeight}
              xAxis={chartXAxis}
              search={d => d.userHistogramAdmin({
                projectId: this.props.server.getProjectId(),
                histogramSearchAdmin: {
                  interval: Admin.HistogramInterval.DAY,
                  filterCreatedStart: moment().subtract(7, 'd').toDate(),
                },
              })}
            />
            <Histogram
              key="Comments"
              icon={DiscussionIcon}
              title={this.props.t('comments')}
              server={this.props.server}
              className={this.props.classes.stat}
              chartWidth={chartWidth}
              chartHeight={chartHeight}
              xAxis={chartXAxis}
              search={d => d.commentHistogramAdmin({
                projectId: this.props.server.getProjectId(),
                histogramSearchAdmin: {
                  interval: Admin.HistogramInterval.DAY,
                  filterCreatedStart: moment().subtract(7, 'd').toDate(),
                },
              })}
            />
          </div>
        </div>
        <div className={classNames(
          this.props.classes.stats,
          this.props.classes.scrollVertical,
        )}>
          {workflows?.map(workflow => !!workflow.aggregate && (
            <DashboardHomeBox
              title={workflowPreviewRenderAggregateLabel(workflow.aggregate)('total', workflow.name)}
              chartAsBackground={workflowPreviewDimensions}
              chart={(
                <WorkflowPreview
                  static
                  width={workflowPreviewDimensions.width}
                  height={workflowPreviewDimensions.height}
                  editor={this.props.editor}
                  categoryIndex={workflow.categoryIndex}
                  hideCorner
                  renderLabel={workflowPreviewRenderAggregateLabel(workflow.aggregate)}
                />
              )}
            />
          ))}
        </div>
        <div className={this.props.classes.postLists}>
          <div className={this.props.classes.postLists}>
            <DashboardHomePostList
              title="Trending"
              server={this.props.server}
              onClickPost={postId => this.props.onPageClick('post', [postId])}
              onUserClick={userId => this.props.onPageClick('user', [userId])}
              search={{
                sortBy: Admin.IdeaSearchAdminSortByEnum.Trending,
              }}
              displayOverride={{
                showCreated: true,
                showVotingCount: true,
                showExpression: true,
                showStatus: true,
                showTags: true,
                showCategoryName: true,
              }}
            />
            {!!this.props.changelog && (
              <DashboardHomePostList
                title="Announcements"
                server={this.props.server}
                onClickPost={postId => this.props.onPageClick('post', [postId])}
                onUserClick={userId => this.props.onPageClick('user', [userId])}
                search={{
                  filterCategoryIds: [this.props.changelog.categoryAndIndex.category.categoryId],
                  sortBy: Admin.IdeaSearchAdminSortByEnum.New,
                }}
                displayOverride={{
                  showCreated: true,
                  showVotingCount: true,
                  showExpression: true,
                  showStatus: true,
                  showTags: true,
                }}
              />
            )}
          </div>
          <div className={this.props.classes.postLists}>
            <DashboardHomeUserList
              title="Recent users"
              server={this.props.server}
              onUserClick={userId => this.props.onPageClick('user', [userId])}
            />
            <DashboardHomePostList
              title="Randomized"
              server={this.props.server}
              onClickPost={postId => this.props.onPageClick('post', [postId])}
              onUserClick={userId => this.props.onPageClick('user', [userId])}
              search={{
                sortBy: Admin.IdeaSearchAdminSortByEnum.Random,
              }}
              displayOverride={{
                showCreated: true,
                showVotingCount: true,
                showExpression: true,
                showStatus: true,
                showTags: true,
                showCategoryName: true,
              }}
            />
          </div>
        </div>
        <div className={this.props.classes.tourChecklistContainer}>
          <DashboardHomeBox
            scroll
            chart={(
              <Provider store={ServerAdmin.get().getStore()}>
                <TourChecklist />
              </Provider>
            )}
          />
        </div>
      </div>
    );
  }
}

export default connect<ConnectProps, {}, Props, ReduxState>((state, ownProps) => {
  const newProps: ConnectProps = {
    configver: state.conf.ver, // force rerender on config change
    config: state.conf.conf,
    loggedInUserId: state.users.loggedIn.user ? state.users.loggedIn.user.userId : undefined,
  };
  if (!state.conf.conf && !state.conf.status) {
    newProps.callOnMount = () => {
      ownProps.server.dispatch().then(d => d.configAndUserBindSlug({
        slug: ownProps.server.getStore().getState().conf.conf?.slug!,
        userBind: {},
      }));
    };
  }
  return newProps;
}, null, null, { forwardRef: true })(withStyles(styles, { withTheme: true })(withRouter(withWidth({ initialWidth })(withTranslation('site', { withRef: true })(withTranslation('site', { withRef: true })(DashboardHome))))));
