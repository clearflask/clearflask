import React, { Component } from 'react';
import { Server, StateIdeas, ReduxState, Status, getSearchKey } from '../../api/server';
import Post from './Post';
import { withStyles, Theme, createStyles, WithStyles } from '@material-ui/core/styles';
import * as Client from '../../api/client';
import { connect } from 'react-redux';
import { Typography } from '@material-ui/core';
import ErrorPage from '../ErrorPage';
import Loading from './Loading';

export enum Direction {
  Horizontal,
  Vertical,
}

interface SearchResult {
  status:Status;
  ideas:(Client.Idea|undefined)[];
  cursor:string|undefined,
}

const styles = (theme:Theme) => createStyles({
  container: {
    display: 'flex',
  },
  nothing: {
    margin: theme.spacing.unit * 4,
    color: theme.palette.text.hint,
  },
  [Direction.Horizontal]: {
  },
  [Direction.Vertical]: {
    flexDirection: 'column',
  },
});

interface Props extends StateIdeas, WithStyles<typeof styles> {
  server:Server;
  panel:Client.PagePanel;
  displayDefaults?:Client.PostDisplay;
  searchOverride?:Partial<Client.IdeaSearch>;
  direction:Direction
  onClickTag?:(tagId:string)=>void;
  onClickCategory?:(categoryId:string)=>void;
  onClickStatus?:(statusId:string)=>void;
  // connect
  config?:Client.Config;
  searchResult:SearchResult;
  searchMerged:Client.IdeaSearch;
}

class Panel extends Component<Props> {
  render() {
    var content;
    switch(this.props.searchResult.status) {
      default:
      case Status.REJECTED:
        content = (
          <ErrorPage msg='Failed to load' />
        );
        break;
      case Status.PENDING:
        if(this.props.panel.hideIfEmpty) return null;
        content = (
          <Loading />
        );
        break;
      case Status.FULFILLED:
        if(this.props.panel.hideIfEmpty && this.props.searchResult.ideas.length === 0) return null;
        if(this.props.searchResult.ideas.length === 0) {
          content = (
            <Typography variant='overline' className={this.props.classes.nothing}>Nothing found</Typography>
          )
        } else {
          const onlyHasOneCategory = (this.props.config && this.props.config.content.categories.length <= 1);

          const display:Client.PostDisplay = {
            titleTruncateLines: 1,
            descriptionTruncateLines: 2,
            ...(onlyHasOneCategory ? {showCategoryName: false} : {}),
            ...(this.props.displayDefaults || {}),
            ...this.props.panel.display,
          }
          content = this.props.searchResult.ideas.map(idea => (
            <Post
              server={this.props.server}
              idea={idea}
              expandable
              onClickTag={this.props.onClickTag}
              onClickCategory={this.props.onClickCategory}
              onClickStatus={this.props.onClickStatus}
              display={display}
            />
          ));
        }
        break;
    }
    return (
      <div className={`${this.props.classes.container} ${this.props.classes[this.props.direction]}`} >
        {content}
      </div>
    );
  }
}

export default connect<any,any,any,any>((state:ReduxState, ownProps:Props) => {
  var newProps = {
    configver: state.conf.ver, // force rerender on config change
    config: state.conf.conf,
    searchResult: {
      status: Status.PENDING,
      ideas: [],
      cursor: undefined,
    } as SearchResult,
    searchMerged: {...ownProps.searchOverride, ...ownProps.panel.search},
  };

  const searchKey = getSearchKey(newProps.searchMerged);
  const bySearch = state.ideas.bySearch[searchKey];
  if(!bySearch) {
    ownProps.server.dispatch().ideaSearch({
      projectId: state.projectId,
      search: newProps.searchMerged,
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
