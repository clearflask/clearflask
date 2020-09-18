import { withWidth, WithWidth } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import { RouteComponentProps, withRouter } from 'react-router';
import * as Client from '../../api/client';
import { getSearchKey, ReduxState, Server } from '../../api/server';
import { vh } from '../../common/util/vhUtil';
import DividerCorner from '../utils/DividerCorner';
import { Direction } from './Panel';
import PanelPost from './PanelPost';
import PanelSearch from './PanelSearch';

const styles = (theme: Theme) => createStyles({
  container: {
    display: 'inline-block',
    width: 'auto',
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
  controls: {
    display: 'flex',
    justifyContent: 'center',
  },
});

interface Props {
  server: Server;
}
interface ConnectProps {
  configver?: string;
  config?: Client.Config;
  loggedInUserId?: string;
}
interface State {
  search?: Partial<Client.IdeaSearch>;
  expanded?: boolean;
}
class IdeaExplorerAdmin extends Component<Props & ConnectProps & WithStyles<typeof styles, true> & RouteComponentProps & WithWidth, State> {
  state: State = {};

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
      };
    return (
      <div className={this.props.classes.container}>
        <div className={this.props.classes.controls}>
          <PanelSearch
            className={this.props.classes.search}
            server={this.props.server}
            search={this.state.search}
            minWidth={200}
            onSearchChanged={search => this.setState({ search: search })}
            explorer={{
              search: {},
              display: {},
              allowSearch: { enableSort: false, enableSearchText: false, enableSearchByCategory: true, enableSearchByStatus: true, enableSearchByTag: true },
            }}
          />
          {/* <FormControlLabel
            className={this.props.classes.expandSwitchLabel}
            control={(
              <Switch
                className={this.props.classes.expandSwitch}
                checked={!!this.state.expanded}
                onChange={(e, checked) => this.setState({ expanded: !this.state.expanded })}
                color='primary'
              />
            )}
            label={this.state.expanded ? 'Expanded' : 'Collapsed'}
          /> */}
        </div>
        <div className={this.props.classes.board}>
          {this.renderPanel('Trending', {
            search: {
              ...this.state.search,
              sortBy: Client.IdeaSearchSortByEnum.Trending,
            }, display
          })}
          {this.renderPanel('New', {
            search: {
              ...this.state.search,
              sortBy: Client.IdeaSearchSortByEnum.New,
            }, display
          })}
          {this.renderPanel('Top', {
            search: {
              ...this.state.search,
              sortBy: Client.IdeaSearchSortByEnum.Top,
            }, display
          })}
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
        />
      </DividerCorner>
    );
  }
}

export default connect<ConnectProps, {}, Props, ReduxState>((state, ownProps) => {
  if (!state.conf.conf && !state.conf.status) {
    ownProps.server.dispatch().configGetAndUserBind({ projectId: ownProps.server.getProjectId(), configGetAndUserBind: {} });
  }
  return {
    configver: state.conf.ver, // force rerender on config change
    config: state.conf.conf,
    loggedInUserId: state.users.loggedIn.user ? state.users.loggedIn.user.userId : undefined,
    settings: state.settings,
  }
}, null, null, { forwardRef: true })(withStyles(styles, { withTheme: true })(withRouter(withWidth()(IdeaExplorerAdmin))));