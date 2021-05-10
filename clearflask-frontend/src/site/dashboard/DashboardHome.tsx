import { Typography, withWidth, WithWidth } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import AllIdeasIcon from '@material-ui/icons/AllInclusive';
import DiscussionIcon from '@material-ui/icons/ChatBubbleOutlined';
import OpenIdeasIcon from '@material-ui/icons/FeedbackOutlined';
import UsersIcon from '@material-ui/icons/PersonAdd';
import moment from 'moment';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import { RouteComponentProps, withRouter } from 'react-router';
import * as Admin from '../../api/admin';
import * as Client from '../../api/client';
import { ReduxState, Server } from '../../api/server';
import { Direction } from '../../app/comps/Panel';
import PanelPost from '../../app/comps/PanelPost';
import PanelSearch from '../../app/comps/PanelSearch';
import DividerCorner from '../../app/utils/DividerCorner';
import { initialWidth } from '../../common/util/screenUtil';
import CategoryStats from './CategoryStats';
import Histogram from './Histogram';

const styles = (theme: Theme) => createStyles({
  page: {
  },
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
  stat: {
  },
});

interface Props {
  server: Server;
  onClickPost: (postId: string) => void;
  onUserClick: (userId: string) => void;
}
interface ConnectProps {
  callOnMount?: () => void,
  configver?: string;
  config?: Client.Config;
  loggedInUserId?: string;
}
interface State {
  search?: Partial<Client.IdeaSearch>;
  expanded?: boolean;
}
class DashboardHome extends Component<Props & ConnectProps & WithStyles<typeof styles, true> & RouteComponentProps & WithWidth, State> {
  state: State = {};

  constructor(props) {
    super(props);

    props.callOnMount?.();
  }

  render() {
    const display: Client.PostDisplay = this.state.expanded ? {
      titleTruncateLines: 1,
      descriptionTruncateLines: 2,
      responseTruncateLines: 2,
      showCommentCount: true,
      showCategoryName: true,
      showCreated: true,
      showAuthor: true,
      showStatus: true,
      showTags: true,
      showVoting: true,
      showFunding: true,
      showExpression: true,
    } : {
      titleTruncateLines: 1,
      descriptionTruncateLines: 0,
      responseTruncateLines: 0,
      showCommentCount: false,
      showCategoryName: false,
      showCreated: false,
      showAuthor: false,
      showStatus: false,
      showTags: false,
      showVoting: false,
      showFunding: false,
      showExpression: false,
      showEdit: false,
    };
    const chartWidth = 100;
    const chartHeight = 50;
    const chartXAxis = {
      min: moment().subtract(7, 'd').toDate(),
      max: new Date(),
    };
    return (
      <div className={this.props.classes.page}>
        <div className={this.props.classes.stats}>
          <Histogram
            icon={OpenIdeasIcon}
            title='Open ideas'
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
              }
            })}
          />
          <Histogram
            icon={AllIdeasIcon}
            title='All Posts'
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
              }
            })}
          />
          <Histogram
            icon={DiscussionIcon}
            title='Comments'
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
              }
            })}
          />
          <Histogram
            icon={UsersIcon}
            title='Identified Users'
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
              }
            })}
          />
        </div>
        <div className={this.props.classes.stats}>
          <CategoryStats
            className={this.props.classes.categoryStats}
            server={this.props.server}
          />
        </div>
        <DividerCorner
          className={this.props.classes.boardContainer}
          header={(
            <Typography className={this.props.classes.title}>Content</Typography>
          )}
          width='70%'
          widthRight={116}
          headerRight={(
            <PanelSearch
              className={this.props.classes.search}
              server={this.props.server}
              search={this.state.search}
              placeholder='Filter'
              onSearchChanged={search => this.setState({ search: search })}
              explorer={{
                search: {},
                display: {},
                allowSearch: { enableSort: false, enableSearchText: true, enableSearchByCategory: true, enableSearchByStatus: true, enableSearchByTag: true },
              }}
            />
          )}
        >
          <div className={this.props.classes.board}>
            {this.renderPanel('Trending', {
              search: {
                ...this.state.search,
                sortBy: Client.IdeaSearchSortByEnum.Trending,
              },
              display: {
                ...display,
                // showFunding: true,
                // showVoting: true,
              },
            })}
            {this.renderPanel('New', {
              search: {
                ...this.state.search,
                sortBy: Client.IdeaSearchSortByEnum.New,
              },
              display: {
                ...display,
                // showCreated: true,
                // showAuthor: true,
              },
            })}
            {this.renderPanel('Top', {
              search: {
                ...this.state.search,
                sortBy: Client.IdeaSearchSortByEnum.Top,
              },
              display: {
                ...display,
                // showFunding: true,
                // showVoting: true,
              },
            })}
          </div>
        </DividerCorner>
      </div>
    );
  }

  renderPanel(
    title: string,
    panel: Client.PagePanel | Client.PagePanelWithHideIfEmpty | Client.PageExplorer,
    searchOverride?: Partial<Client.IdeaSearch>,
    displayDefaults?: Client.PostDisplay,
  ) {
    return (
      <DividerCorner
        className={this.props.classes.boardPanel}
        title={title}
        isExplorer
      >
        <PanelPost
          maxHeight={this.props.theme.vh(80)}
          direction={Direction.Vertical}
          panel={panel}
          searchOverride={searchOverride}
          server={this.props.server}
          displayDefaults={displayDefaults}
          onClickPost={this.props.onClickPost}
          onUserClick={this.props.onUserClick}
        />
      </DividerCorner>
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
        userBind: {}
      }));
    };
  }
  return newProps;
}, null, null, { forwardRef: true })(withStyles(styles, { withTheme: true })(withRouter(withWidth({ initialWidth })(DashboardHome))));
