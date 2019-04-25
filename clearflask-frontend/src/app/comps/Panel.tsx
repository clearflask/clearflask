import React, { Component } from 'react';
import { Server, StateIdeas, ReduxState, Status, getSearchKey } from '../../api/server';
import Post, { PostVariant } from './Post';
import { withStyles, Theme, createStyles, WithStyles } from '@material-ui/core/styles';
import * as Client from '../../api/client';
import { connect } from 'react-redux';

export enum Direction {
  Horizontal,
  Vertical,
  Wrap,
}

interface SearchResult {
  status:Status;
  ideas:(Client.Idea|undefined)[];
  cursor:string|undefined,
}

const styles = (theme:Theme) => createStyles({
  container: {
  },
  [Direction.Horizontal]: {
  },
  [Direction.Vertical]: {
    flexDirection: 'column',
  },
  [Direction.Wrap]: {
    flexWrap: 'wrap',
  },
});

interface Props extends StateIdeas, WithStyles<typeof styles> {
  server:Server;
  panel:Client.PagePanel;
  searchOverride?:Partial<Client.IdeaSearch>;
  direction:Direction
  // connect
  config?:Client.Config;
  searchResult:SearchResult;
}

class Panel extends Component<Props> {
  readonly styles = {
    container: {
      display: 'flex',
    },
  };

  render() {
    if(this.props.panel.hideIfEmpty && this.props.searchResult.ideas.length === 0) {
      return null;
    }
    return (
      <div className={`${this.props.classes.container} ${this.props.classes[this.props.direction]}`} >
        {this.props.searchResult.ideas.map(idea => (
          <Post
            server={this.props.server}
            idea={idea}
            variant='list'
            titleTruncateLines={this.props.panel.display.titleTruncateLines || 1}
            descriptionTruncateLines={this.props.panel.display.descriptionTruncateLines || 2}
            hideCommentCount={this.props.panel.display.hideCommentCount}
            hideCategoryName={this.props.panel.display.hideCategoryName
              || (this.props.config && this.props.config.content.categories.length <= 1)
              || (this.props.panel.search.filterCategoryIds && this.props.panel.search.filterCategoryIds.length === 1)}
            hideCreated={this.props.panel.display.hideCreated}
            hideAuthor={this.props.panel.display.hideAuthor}
            hideStatus={this.props.panel.display.hideStatus
              || (this.props.panel.search.filterStatusIds && this.props.panel.search.filterStatusIds.length === 1)}
            hideTags={this.props.panel.display.hideTags
              || (this.props.panel.search.filterTagIds && this.props.panel.search.filterTagIds.length === 1)}
            hideVoting={this.props.panel.display.hideVoting}
            hideFunding={this.props.panel.display.hideFunding}
            hideExpression={this.props.panel.display.hideExpression}
            hideDescription={this.props.panel.display.hideDescription}
          />
        ))}
      </div>
    );
  }
}

export default connect<any,any,any,any>((state:ReduxState, ownProps:Props) => {
  var newProps = {
    config: state.conf.conf,
    searchResult: {
      status: Status.PENDING,
      ideas: [],
      cursor: undefined,
    } as SearchResult,
  };

  const search = {...ownProps.searchOverride, ...ownProps.panel.search};
  const searchKey = getSearchKey(search);
  const bySearch = state.ideas.bySearch[searchKey];
  if(!bySearch) {
    ownProps.server.dispatch().ideaSearch({
      projectId: state.projectId,
      search: search,
    });
  } else {
    newProps.searchResult.status = bySearch.status;
    newProps.searchResult.cursor = bySearch.cursor;
    newProps.searchResult.ideas = (bySearch.ideaIds || []).map(ideaId => {
      const idea = state.ideas.byId[ideaId];
      return (idea && idea.status === Status.FULFILLED)
        ? idea.idea
        : undefined;
    });
  }

  return newProps;
})(withStyles(styles, { withTheme: true })(Panel));
