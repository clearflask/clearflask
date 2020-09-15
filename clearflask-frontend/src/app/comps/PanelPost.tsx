import { Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import * as Client from '../../api/client';
import { getSearchKey, ReduxState, Server, Status } from '../../api/server';
import ErrorMsg from '../ErrorMsg';
import Loading from '../utils/Loading';
import Panel from './Panel';
import Post from './Post';

export enum Direction {
  Horizontal,
  Vertical,
}

interface SearchResult {
  status: Status;
  ideas: (Client.Idea | undefined)[];
  cursor: string | undefined,
}

const styles = (theme: Theme) => createStyles({
  nothing: {
    margin: theme.spacing(4),
    color: theme.palette.text.secondary,
  },
});

export interface Props {
  server: Server;
  panel: Client.PagePanel | Client.PagePanelWithHideIfEmpty | Client.PageExplorer;
  displayDefaults?: Client.PostDisplay;
  searchOverride?: Partial<Client.IdeaSearch>;
  direction: Direction
  maxHeight?: string | number,
  onClickPost?: (postId: string) => void;
  forceDisablePostExpand?: boolean;
}
interface ConnectProps {
  configver?: string;
  config?: Client.Config;
  searchResult: SearchResult;
  searchMerged: Client.IdeaSearch;
}
class PanelPost extends Component<Props & ConnectProps & WithStyles<typeof styles, true>> {
  render() {
    var content;
    switch (this.props.searchResult.status) {
      default:
      case Status.REJECTED:
        content = (
          <ErrorMsg msg='Failed to load' />
        );
        break;
      case Status.PENDING:
        if ((this.props.panel as Client.PagePanelWithHideIfEmpty).hideIfEmpty) return null;
        content = (
          <Loading />
        );
        break;
      case Status.FULFILLED:
        if ((this.props.panel as Client.PagePanelWithHideIfEmpty).hideIfEmpty && this.props.searchResult.ideas.length === 0) return null;
        if (this.props.searchResult.ideas.length === 0) {
          content = (
            <Typography variant='overline' className={this.props.classes.nothing}>Nothing found</Typography>
          )
        } else {
          const onlyHasOneCategory = (this.props.config && this.props.config.content.categories.length <= 1
            || (this.props.panel.search.filterCategoryIds && this.props.panel.search.filterCategoryIds.length === 1));

          const display: Client.PostDisplay = {
            titleTruncateLines: 1,
            descriptionTruncateLines: 2,
            ...(onlyHasOneCategory ? { showCategoryName: false } : {}),
            ...(this.props.displayDefaults || {}),
            ...this.props.panel.display,
          }
          content = this.props.searchResult.ideas.map(idea => (
            <Post
              key={idea && idea.ideaId}
              server={this.props.server}
              idea={idea}
              expandable
              forceDisablePostExpand={this.props.forceDisablePostExpand}
              onClickPost={this.props.onClickPost}
              display={display}
              variant='list'
            />
          ));
        }
        break;
    }
    return (
      <Panel
        title={this.props.panel.title}
        direction={this.props.direction}
        maxHeight={this.props.maxHeight}
      >
        {content}
      </Panel>
    );
  }
}

export default connect<ConnectProps, {}, Props, ReduxState>((state: ReduxState, ownProps: Props) => {
  var newProps: ConnectProps = {
    configver: state.conf.ver, // force rerender on config change
    config: state.conf.conf,
    searchResult: {
      status: Status.PENDING,
      ideas: [],
      cursor: undefined,
    } as SearchResult,
    searchMerged: { ...ownProps.searchOverride, ...ownProps.panel.search },
  };

  const searchKey = getSearchKey(newProps.searchMerged);
  const bySearch = state.ideas.bySearch[searchKey];
  if (!bySearch) {
    ownProps.server.dispatch().ideaSearch({
      projectId: state.projectId,
      ideaSearch: newProps.searchMerged,
    });
  } else {
    const missingVotesByIdeaIds: string[] = [];
    newProps.searchResult.status = bySearch.status;
    newProps.searchResult.cursor = bySearch.cursor;
    newProps.searchResult.ideas = (bySearch.ideaIds || []).map(ideaId => {
      if (state.votes.statusByIdeaId[ideaId] === undefined) missingVotesByIdeaIds.push(ideaId);
      const idea = state.ideas.byId[ideaId];
      return (idea && idea.status === Status.FULFILLED)
        ? idea.idea
        : undefined;
    });
    if (state.users.loggedIn.status === Status.FULFILLED && missingVotesByIdeaIds.length > 0) {
      ownProps.server.dispatch().ideaVoteGetOwn({
        projectId: state.projectId,
        ideaIds: missingVotesByIdeaIds,
      });
    }
  }

  return newProps;
})(withStyles(styles, { withTheme: true })(PanelPost));
