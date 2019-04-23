import React, { Component } from 'react';
import { Server, StateIdeas, ReduxState, Status } from '../../api/server';
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
    margin: theme.spacing.unit,
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
  search:Client.IdeaSearch;
  direction:Direction
  ideaCardVariant:PostVariant;
  // connect
  searchResult:SearchResult;
}

class Panel extends Component<Props> {
  readonly styles = {
    container: {
      display: 'flex',
    },
  };

  render() {
    return (
      <div className={`${this.props.classes.container} ${this.props.classes[this.props.direction]}`} >
        {this.props.searchResult.ideas.map(idea => (
          <Post server={this.props.server} idea={idea} variant={this.props.ideaCardVariant} />
        ))}
      </div>
    );
  }
}

export default connect<any,any,any,any>((state:ReduxState, ownProps:Props) => {
  var newProps = {
    searchResult: {
      status: Status.PENDING,
      ideas: [],
      cursor: undefined,
    } as SearchResult,
  };

  const bySearch = state.ideas.bySearch[ownProps.search.searchKey];
  if(!bySearch) {
    ownProps.server.dispatch().ideaSearch({
      projectId: state.projectId,
      search: ownProps.search,
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
