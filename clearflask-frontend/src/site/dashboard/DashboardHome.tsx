import { Typography, withWidth, WithWidth } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import { RouteComponentProps, withRouter } from 'react-router';
import * as Client from '../../api/client';
import { getSearchKey, ReduxState, Server } from '../../api/server';
import { Direction } from '../../app/comps/Panel';
import PanelPost from '../../app/comps/PanelPost';
import PanelSearch from '../../app/comps/PanelSearch';
import DividerCorner from '../../app/utils/DividerCorner';
import Loader from '../../app/utils/Loader';
import { initialWidth, vh } from '../../common/util/screenUtil';
import CategoryStats from './CategoryStats';
import UserExplorer from './UserExplorer';

const styles = (theme: Theme) => createStyles({
  page: {
  },
  sections: {
    display: 'inline-flex',
    width: 'fit-content',
    flexWrap: 'wrap',
  },
  boardContainer: {
    margin: theme.spacing(4, 0),
    flexShrink: 1,
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
  usersCount?: number;
}
class DashboardHome extends Component<Props & ConnectProps & WithStyles<typeof styles, true> & RouteComponentProps & WithWidth, State> {
  state: State = {};

  componentDidMount() {
    this.props.callOnMount && this.props.callOnMount();
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
    return (
      <div className={this.props.classes.page}>
        <Typography variant='h4' component='h1'>Welcome back!</Typography>
        <div className={this.props.classes.sections}>
          <CategoryStats
            className={this.props.classes.categoryStats}
            server={this.props.server}
            maxContentHeight={300}
          />
          <div className={this.props.classes.spacer} />
          <DividerCorner
            className={this.props.classes.users}
            title='Users'
            width='70%'
          >
            <div className={this.props.classes.resultsContainer}>
              <DividerCorner
                className={this.props.classes.resultsItem}
                innerClassName={this.props.classes.resultsItemInner}
                title='Total'
              >
                <Loader loaded={this.state.usersCount !== undefined}>
                  <Typography className={this.props.classes.bigValue}>
                    {this.state.usersCount}
                  </Typography>
                </Loader>
              </DividerCorner>
              <UserExplorer
                className={this.props.classes.userExplorer}
                title='New'
                titleSize={70}
                server={this.props.server}
                nameOnly
                onUserClick={this.props.onUserClick}
                hideShowMore
                maxContentHeight={300}
                onResults={results => this.setState({ usersCount: results.hits?.value })}
              />
            </div>
          </DividerCorner>
          <div className={this.props.classes.spacer} />
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
          key={getSearchKey({ ...searchOverride, ...panel.search })}
          maxHeight={vh(80)}
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
