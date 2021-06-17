import { Divider, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import classNames from 'classnames';
import { MarginProperty } from 'csstype';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import { createSelector } from 'reselect';
import * as Admin from '../../api/admin';
import * as Client from '../../api/client';
import { getSearchKey, ReduxState, Server, Status } from '../../api/server';
import { notEmpty } from '../../common/util/arrayUtil';
import keyMapper from '../../common/util/keyMapper';
import { customShouldComponentUpdate } from '../../common/util/reactUtil';
import { selectorContentWrap } from '../../common/util/reselectUtil';
import ErrorMsg from '../ErrorMsg';
import DividerVertical from '../utils/DividerVertical';
import Loading from '../utils/Loading';
import Panel from './Panel';
import Post, { MaxContentWidth } from './Post';

export enum Direction {
  Horizontal,
  Vertical,
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
  placeholderHidden: {
    maxHeight: 0,
    padding: 0,
    margin: 0,
    visibility: 'hidden',
  },
  widthExpandMarginSupplied: {
    padding: (props: Props) => props.widthExpandMargin,
  },
  widthExpandMargin: {
    [theme.breakpoints.only('xs')]: {
      margin: theme.spacing(2, 2),
      '&:first-child': { marginTop: theme.spacing(4) },
      '&:last-child': { marginBottom: theme.spacing(4) },
    },
    [theme.breakpoints.only('sm')]: {
      margin: theme.spacing(2, 2),
      '&:first-child': { marginTop: theme.spacing(4) },
      '&:last-child': { marginBottom: theme.spacing(4) },
    },
    [theme.breakpoints.up('md')]: {
      margin: theme.spacing(3, 4),
      '&:first-child': { marginTop: theme.spacing(6) },
      '&:last-child': { marginBottom: theme.spacing(6) },
    },
  },
});

export interface Props {
  className?: string;
  postClassName?: string;
  server: Server;
  panel: Client.PagePanel | Client.PagePanelWithHideIfEmpty | Client.PageExplorer;
  overrideTitle?: React.ReactNode;
  preContent?: React.ReactNode;
  widthExpand?: boolean;
  widthExpandMargin?: MarginProperty<string | number>;
  showDivider?: boolean;
  displayDefaults?: Client.PostDisplay;
  searchOverride?: Partial<Client.IdeaSearch>;
  searchOverrideAdmin?: Partial<Admin.IdeaSearchAdmin>;
  direction: Direction;
  maxHeight?: string | number;
  onClickPost?: (postId: string) => void;
  onUserClick?: (userId: string) => void;
  disableOnClick?: boolean;
  suppressPanel?: boolean;
  PostProps?: Partial<React.ComponentProps<typeof Post>>;
  selectedPostId?: string;
  selectedPostClassName?: string;
  renderPost?: (post: Client.Idea, index: number) => React.ReactNode;
  wrapPost?: (post: Client.Idea, postNode: React.ReactNode, index: number) => React.ReactNode;
}
interface ConnectProps {
  configver?: string;
  config?: Client.Config;
  searchStatus?: Status;
  searchIdeas: Client.Idea[];
  searchCursor: string | undefined,
  missingVotes?: string[];
  projectId?: string;
  loggedInUser?: Client.User;
}
class PanelPost extends Component<Props & ConnectProps & WithStyles<typeof styles, true>> {

  constructor(props) {
    super(props);

    if (!props.searchStatus) {
      const searchMerged = {
        ...props.panel.search,
        ...props.searchOverride,
        ...props.searchOverrideAdmin,
      };
      if (!props.searchOverrideAdmin) {
        props.server.dispatch({ ssr: true }).then(d => d.ideaSearch({
          projectId: props.projectId,
          ideaSearch: searchMerged,
        }));
      } else {
        props.server.dispatchAdmin({ ssr: true }).then(d => d.ideaSearchAdmin({
          projectId: props.projectId,
          ideaSearchAdmin: searchMerged,
        }));
      }
    } else if (props.missingVotes?.length) {
      props.server.dispatch().then(d => d.ideaVoteGetOwn({
        projectId: props.projectId,
        ideaIds: props.missingVotes,
        myOwnIdeaIds: props.missingVotes
          .map(ideaId => props.searchIdeas.find(i => i.ideaId === ideaId))
          .filter(idea => idea?.idea?.authorUserId === props.loggedInUser.userId)
          .map(idea => idea?.idea?.ideaId)
          .filter(notEmpty),
      }));
    }
  }

  shouldComponentUpdate = customShouldComponentUpdate({
    nested: new Set(['panel', 'displayDefaults', 'searchOverride', 'searchOverrideAdmin', 'PostProps']),
  });

  render() {
    const widthExpandMarginClassName = this.props.widthExpandMargin === undefined
      ? this.props.classes.widthExpandMargin : this.props.classes.widthExpandMarginSupplied;
    const hideIfEmpty = !!this.props.panel['hideIfEmpty'];
    var content;
    switch (this.props.searchStatus) {
      default:
      case Status.REJECTED:
        content = (
          <div className={classNames(this.props.widthExpand && widthExpandMarginClassName, this.props.classes.placeholder)}>
            <ErrorMsg msg='Failed to load' />
          </div>
        );
        break;
      case Status.PENDING:
        if (hideIfEmpty) return null;
        content = (
          <div className={classNames(this.props.widthExpand && widthExpandMarginClassName, this.props.classes.placeholder)}>
            <Loading />
          </div>
        );
        break;
      case Status.FULFILLED:
        if (hideIfEmpty && this.props.searchIdeas.length === 0) return null;

        const onlyHasOneCategory = (this.props.config && this.props.config.content.categories.length <= 1
          || (this.props.panel.search.filterCategoryIds && this.props.panel.search.filterCategoryIds.length === 1));

        const display: Client.PostDisplay = {
          titleTruncateLines: 1,
          descriptionTruncateLines: 2,
          ...(onlyHasOneCategory ? { showCategoryName: false } : {}),
          ...(this.props.displayDefaults || {}),
          ...this.props.panel.display,
        }
        content = this.props.searchIdeas.map((idea, ideaIndex) => {
          var content: React.ReactNode;
          if (this.props.renderPost) {
            content = this.props.renderPost(idea, ideaIndex);
          } else {
            content = (
              <Post
                key={idea.ideaId}
                className={classNames(
                  this.props.widthExpand && widthExpandMarginClassName,
                  this.props.postClassName,
                  this.props.selectedPostId === idea.ideaId && this.props.selectedPostClassName,
                )}
                server={this.props.server}
                idea={idea}
                widthExpand={this.props.widthExpand}
                expandable
                disableOnClick={this.props.disableOnClick}
                onClickPost={this.props.onClickPost}
                onUserClick={this.props.onUserClick}
                display={display}
                variant='list'
                {...this.props.PostProps}
              />
            );
          }
          if (this.props.wrapPost) {
            content = (
              <React.Fragment key={idea.ideaId}>
                {this.props.wrapPost(idea, content, ideaIndex)}
              </React.Fragment>
            );
          }
          return content;
        });
        if (this.props.showDivider) {
          content = content.map(post => (
            <>
              {post}
              {this.props.direction === Direction.Vertical
                ? (<Divider />)
                : (<DividerVertical />)
              }
            </>
          ));
        }
        content = (
          <>
            {content}
            <div
              className={classNames(
                this.props.widthExpand && widthExpandMarginClassName,
                this.props.classes.placeholder,
                // Just hide instead of removing to prevent the width from collapsing
                this.props.searchIdeas.length && this.props.classes.placeholderHidden,
              )}
            >
              <Typography variant='overline' style={{
              }}>Nothing found</Typography>
            </div>
          </>
        );
        break;
    }
    content = this.props.suppressPanel ? content : (
      <Panel
        className={this.props.className}
        title={this.props.overrideTitle || this.props.panel['title']}
        direction={this.props.direction}
        maxHeight={this.props.maxHeight}
      >
        {this.props.preContent}
        {content}
      </Panel>
    );
    return content;
  }
}

// const selectCallOnMount = createSelector(
//   (state: ReduxState) => state.projectId,
//   (_, ownProps: Props) => ownProps.server,
//   (_, ownProps: Props) => !!ownProps.searchOverrideAdmin,
//   selectSearchMerged,
//   selectSearch,
//   (projectId, server, isAdminSearch, searchMerged, search) => {
//     if (!search) {
//       if (!isAdminSearch) {
//         return () => {
//           server.dispatch({ ssr: true }).then(d => d.ideaSearch({
//             projectId: projectId!,
//             ideaSearch: searchMerged as Client.IdeaSearch,
//           }));
//         };
//       } else {
//         return () => {
//           server.dispatchAdmin({ ssr: true }).then(d => d.ideaSearchAdmin({
//             projectId: projectId!,
//             ideaSearchAdmin: searchMerged as Admin.IdeaSearchAdmin,
//           }));
//         };
//       }
//     }
//     return undefined;
//   });

export default keyMapper(
  (ownProps: Props) => getSearchKey({
    ...ownProps.panel.search,
    ...ownProps.searchOverride,
    ...ownProps.searchOverrideAdmin,
  }),
  connect<ConnectProps, {}, Props, ReduxState>(() => {
    const selectIsAdminSearch = (_, ownProps: Props): boolean => !!ownProps.searchOverrideAdmin;
    const selectSearchMerged = (_, ownProps: Props): Client.IdeaSearch | Admin.IdeaSearchAdmin => ({
      ...ownProps.panel.search,
      ...ownProps.searchOverride,
      ...ownProps.searchOverrideAdmin,
    });
    const selectSearchKey = createSelector(
      [selectSearchMerged],
      (searchMerged) => getSearchKey(searchMerged)
    );
    const selectIdeasBySearch = (state: ReduxState) => state.ideas.bySearch;
    const selectIdeasById = (state: ReduxState) => state.ideas.byId;
    const selectSearch = createSelector(
      [selectSearchKey, selectIdeasBySearch],
      (searchKey, ideasBySearch) => searchKey ? ideasBySearch[searchKey] : undefined
    );
    const selectVotesStatusByIdeaId = (state: ReduxState) => state.votes.statusByIdeaId;

    const selectMissingVotes = selectorContentWrap(createSelector(
      [selectSearch, selectVotesStatusByIdeaId, selectIsAdminSearch],
      (search, votesStatusByIdeaId, isAdminSearch) => {
        const missing: string[] = [];
        if (isAdminSearch) return missing; // Don't get votes if calling admin search
        search?.ideaIds?.forEach(ideaId => {
          if (votesStatusByIdeaId[ideaId] === undefined) {
            missing.push(ideaId);
          }
        });
        return missing.length ? missing : undefined;
      }
    ));

    const selectIdeas = selectorContentWrap(createSelector(
      [selectSearch, selectIdeasById],
      (search, byId) => {
        const ideas = (search?.ideaIds || []).map(ideaId => {
          const idea = byId[ideaId];
          if (!idea || idea.status !== Status.FULFILLED) return undefined;
          return idea.idea;
        }).filter(notEmpty);
        return ideas.length ? ideas : undefined;
      }));

    const selectConnectProps = createSelector(
      selectMissingVotes,
      selectIdeas,
      selectSearch,
      (state: ReduxState) => state.conf.ver,
      (state: ReduxState) => state.conf.conf,
      (state: ReduxState) => state.projectId,
      (state: ReduxState) => state.users.loggedIn.user,
      (missingVotes, ideas, search, configver, config, projectId, loggedInUser) => {
        const connectProps: ConnectProps = {
          config,
          configver,
          searchStatus: search?.status,
          searchCursor: search?.cursor,
          searchIdeas: ideas || [],
          missingVotes,
          projectId: projectId || undefined,
          loggedInUser,
        };
        return connectProps;
      });
    return (state, ownProps) => selectConnectProps(state, ownProps);
  })(withStyles(styles, { withTheme: true })(PanelPost)));
