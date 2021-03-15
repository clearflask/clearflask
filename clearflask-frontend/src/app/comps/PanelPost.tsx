import { Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import classNames from 'classnames';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import * as Client from '../../api/client';
import { getSearchKey, ReduxState, Server, Status } from '../../api/server';
import notEmpty from '../../common/util/arrayUtil';
import ErrorMsg from '../ErrorMsg';
import Loading from '../utils/Loading';
import Panel from './Panel';
import Post, { MaxContentWidth } from './Post';

export enum Direction {
  Horizontal,
  Vertical,
}

interface SearchResult {
  status: Status;
  ideas: Client.Idea[];
  cursor: string | undefined,
}

const styles = (theme: Theme) => createStyles({
  placeholder: {
    padding: theme.spacing(4),
    color: theme.palette.text.secondary,
    boxSizing: 'border-box',
    minWidth: 300,
    width: (props: Props) => props.widthExpand ? MaxContentWidth : '100%',
    maxWidth: (props: Props) => props.widthExpand ? '100%' : MaxContentWidth,
    display: 'inline-block',
  },
  widthExpandMargin: {
    [theme.breakpoints.only('xs')]: {
      margin: theme.spacing(4, 2),
    },
    [theme.breakpoints.only('sm')]: {
      margin: theme.spacing(4, 2),
    },
    [theme.breakpoints.up('md')]: {
      margin: theme.spacing(6, 4),
    },
    '&:not(:last-child)': {
      marginBottom: 0,
    },
  },
});

export interface Props {
  className?: string;
  server: Server;
  panel: Client.PagePanel | Client.PagePanelWithHideIfEmpty | Client.PageExplorer;
  widthExpand?: boolean;
  displayDefaults?: Client.PostDisplay;
  searchOverride?: Partial<Client.IdeaSearch>;
  direction: Direction
  maxHeight?: string | number,
  onClickPost?: (postId: string) => void;
  onUserClick?: (userId: string) => void;
  forceDisablePostExpand?: boolean;
  suppressPanel?: boolean;
  PostProps?: Partial<React.ComponentProps<typeof Post>>;
}
interface ConnectProps {
  callOnMount?: () => void,
  configver?: string;
  config?: Client.Config;
  searchResult: SearchResult;
  searchMerged: Client.IdeaSearch;
}
class PanelPost extends Component<Props & ConnectProps & WithStyles<typeof styles, true>> {

  constructor(props) {
    super(props);

    props.callOnMount?.();
  }

  render() {
    const hideIfEmpty = !!this.props.panel['hideIfEmpty'];
    var content;
    switch (this.props.searchResult.status) {
      default:
      case Status.REJECTED:
        content = (
          <div className={classNames(this.props.widthExpand && this.props.classes.widthExpandMargin, this.props.classes.placeholder)}>
            <ErrorMsg msg='Failed to load' />
          </div>
        );
        break;
      case Status.PENDING:
        if (hideIfEmpty) return null;
        content = (
          <div className={classNames(this.props.widthExpand && this.props.classes.widthExpandMargin, this.props.classes.placeholder)}>
            <Loading />
          </div>
        );
        break;
      case Status.FULFILLED:
        if (hideIfEmpty && this.props.searchResult.ideas.length === 0) return null;
        if (this.props.searchResult.ideas.length === 0) {
          content = (
            <div className={classNames(this.props.widthExpand && this.props.classes.widthExpandMargin, this.props.classes.placeholder)}>
              <Typography variant='overline'>Nothing found</Typography>
            </div>
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
              className={classNames(this.props.widthExpand && this.props.classes.widthExpandMargin)}
              key={idea.ideaId}
              server={this.props.server}
              idea={idea}
              widthExpand={this.props.widthExpand}
              expandable
              forceDisablePostExpand={this.props.forceDisablePostExpand}
              onClickPost={this.props.onClickPost}
              onUserClick={this.props.onUserClick}
              display={display}
              variant='list'
              {...this.props.PostProps}
            />
          ));
        }
        break;
    }
    content = this.props.suppressPanel ? content : (
      <Panel
        className={this.props.className}
        title={this.props.panel['title']}
        direction={this.props.direction}
        maxHeight={this.props.maxHeight}
      >
        {content}
      </Panel>
    );
    return content;
  }
}

export default connect<ConnectProps, {}, Props, ReduxState>((state: ReduxState, ownProps: Props) => {
  const newProps: ConnectProps = {
    configver: state.conf.ver, // force rerender on config change
    config: state.conf.conf,
    searchResult: {
      status: Status.PENDING,
      ideas: [],
      cursor: undefined,
    } as SearchResult,
    searchMerged: {
      ...ownProps.panel.search,
      ...ownProps.searchOverride,
    },
  };

  const searchKey = getSearchKey(newProps.searchMerged);
  const bySearch = state.ideas.bySearch[searchKey];
  if (!bySearch) {
    newProps.callOnMount = () => {
      ownProps.server.dispatch({ ssr: true }).then(d => d.ideaSearch({
        projectId: state.projectId!,
        ideaSearch: newProps.searchMerged,
      }));
    };
  } else {
    const missingVotesByIdeaIds: string[] = [];
    newProps.searchResult.status = bySearch.status;
    newProps.searchResult.cursor = bySearch.cursor;
    newProps.searchResult.ideas = (bySearch.ideaIds || []).map(ideaId => {
      const idea = state.ideas.byId[ideaId];
      if (!idea || idea.status !== Status.FULFILLED) return undefined;
      if (state.votes.statusByIdeaId[ideaId] === undefined) missingVotesByIdeaIds.push(ideaId);
      return idea.idea;
    }).filter(notEmpty);
    if (state.users.loggedIn.status === Status.FULFILLED
      && state.users.loggedIn.user
      && missingVotesByIdeaIds.length > 0) {
      newProps.callOnMount = () => {
        ownProps.server.dispatch().then(d => d.ideaVoteGetOwn({
          projectId: state.projectId!,
          ideaIds: missingVotesByIdeaIds,
          myOwnIdeaIds: missingVotesByIdeaIds
            .map(ideaId => state.ideas.byId[ideaId])
            .filter(idea => idea?.idea?.authorUserId === state.users.loggedIn.user?.userId)
            .map(idea => idea?.idea?.ideaId)
            .filter(notEmpty),
        }));
      };
    }
  }

  return newProps;
})(withStyles(styles, { withTheme: true })(PanelPost));
