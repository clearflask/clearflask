// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { Collapse, Typography } from '@material-ui/core';
import { createStyles, makeStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import classNames from 'classnames';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import { createSelector } from 'reselect';
import * as Admin from '../../api/admin';
import * as Client from '../../api/client';
import { getSearchKey, ReduxState, Server, Status } from '../../api/server';
import { notEmpty } from '../../common/util/arrayUtil';
import keyMapper from '../../common/util/keyMapper';
import { customShouldComponentUpdate } from '../../common/util/reactUtil';
import { MutableRef } from '../../common/util/refUtil';
import { selectorContentWrap } from '../../common/util/reselectUtil';
import { TabFragment, TabsVertical } from '../../common/util/tabsUtil';
import windowIso from '../../common/windowIso';
import ErrorMsg from '../ErrorMsg';
import Loading from '../utils/Loading';
import LoadMoreButton from './LoadMoreButton';
import Panel, { PanelTitle } from './Panel';
import Post, { MaxContentWidth, PostClassification, PostDescription, PostTitle } from './Post';
import { WithTranslation, withTranslation } from 'react-i18next';

export interface PanelPostNavigator {
  hasPrevious(): boolean;
  getPreviousId(): string | undefined;
  previous(): boolean;
  hasNext(): boolean;
  getNextId(): Promise<string | undefined>;
  next(): Promise<boolean>;
}

export enum Direction {
  Horizontal,
  Vertical,
}

const styles = (theme: Theme) => createStyles({
  placeholder: {
    padding: theme.spacing(4),
    color: theme.palette.text.secondary,
    boxSizing: 'border-box',
    width: (props: Props) => props.widthExpand ? MaxContentWidth : '100%',
    maxWidth: (props: Props) => props.widthExpand ? '100%' : MaxContentWidth,
    display: 'inline-block',
  },
  marginsSupplied: {

    padding: (props: Props) => props.margins,
  },
  marginsDefault: {
    padding: (props: Props) => props.direction === Direction.Horizontal ? theme.spacing(0, 1) : theme.spacing(1, 0),
    [theme.breakpoints.up('md')]: {
      padding: (props: Props) => props.direction === Direction.Horizontal ? theme.spacing(1, 2) : theme.spacing(2, 1),
    },
  },
  item: {
    transition: theme.transitions.create(['opacity']),
  },
  itemLoading: {
    opacity: 0.5,
  },
});
export interface Props {
  className?: string;
  postClassName?: string;
  server: Server;
  panel?: Partial<Client.PagePanel | Client.PagePanelWithHideIfEmpty | Client.PageExplorer>;
  overrideTitle?: React.ReactNode;
  preContent?: React.ReactNode;
  widthExpand?: boolean;
  margins?: string | number;
  displayDefaults?: Client.PostDisplay;
  searchOverride?: Partial<Client.IdeaSearch>;
  searchOverrideAdmin?: Partial<Admin.IdeaSearchAdmin>;
  direction: Direction;
  maxHeight?: string | number;
  onClickPost?: (postId: string) => void;
  onClickPostExpand?: boolean;
  onUserClick?: (userId: string) => void;
  disableOnClick?: boolean;
  suppressPanel?: boolean;
  hideLoadMore?: boolean;
  PostProps?: Partial<React.ComponentProps<typeof Post>>;
  renderPost?: (post: Client.Idea, index: number) => React.ReactNode;
  renderEmpty?: () => React.ReactNode;
  wrapPost?: (post: Client.Idea, postNode: React.ReactNode, index: number, selected: boolean) => React.ReactNode;
  filterPosts?: (post: Client.Idea) => boolean;
  onHasAnyChanged?: (hasAny: boolean, count: number) => void;
  navigatorRef?: MutableRef<PanelPostNavigator>;
  selectable?: 'highlight' | 'check';
  selected?: string;
  navigatorChanged?: () => void;
  showDrafts?: {
    onClickDraft?: (draftId: string) => void,
    selectedDraftId?: string;
  };
  hideSearchResultPostIds?: Set<string>;
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
  draftSearchMerged?: Admin.IdeaDraftSearch;
  draftSearchStatus?: Status;
  draftSearchDrafts?: Admin.IdeaDraftAdmin[];
  draftSearchCursor?: string,
}
interface State {
  expandedPostId?: string;
}
class PanelPost extends Component<Props & ConnectProps & WithTranslation<'app'> & WithStyles<typeof styles, true>, State> implements PanelPostNavigator {
  state: State = {};
  notifiedHasAnyCount?: number;

  constructor(props) {
    super(props);

    if (this.props.navigatorRef) this.props.navigatorRef.current = this;
  }

  async loadMore(): Promise<undefined | Client.IdeaWithVoteSearchResponse | Admin.IdeaSearchResponse> {
    if (!this.props.projectId) return;
    if (!!this.props.searchStatus && !this.props.searchCursor) return;
    if (!this.props.searchOverrideAdmin) {
      return await (await this.props.server.dispatch({ ssr: true, debounce: true })).ideaSearch({
        projectId: this.props.projectId,
        ideaSearch: {
          ...(this.props.panel?.search || {}),
          ...this.props.searchOverride,
        },
        cursor: this.props.searchCursor,
      });
    } else {
      return await (await this.props.server.dispatchAdmin({ ssr: true, debounce: true })).ideaSearchAdmin({
        projectId: this.props.projectId,
        ideaSearchAdmin: {
          ...(this.props.panel?.search || {}),
          ...this.props.searchOverrideAdmin,
        } as any,
        cursor: this.props.searchCursor,
      });
    }
  }

  shouldComponentUpdate = customShouldComponentUpdate({
    nested: new Set(['panel', 'displayDefaults', 'searchOverride', 'searchOverrideAdmin', 'PostProps', 'missingVotes']),
  });

  componentDidMount() {
    if (this.props.missingVotes?.length) {
      const missingVotes = this.props.missingVotes;
      this.props.server.dispatch().then(d => d.ideaVoteGetOwn({
        projectId: this.props.projectId!,
        ideaIds: missingVotes,
        myOwnIdeaIds: missingVotes
          .map(ideaId => this.props.searchIdeas.find(i => i.ideaId === ideaId))
          .filter(idea => idea?.authorUserId === this.props.loggedInUser?.userId)
          .map(idea => idea?.ideaId)
          .filter(notEmpty),
      }));
    }
  }

  componentDidUpdate(prevProps, prevState) {
    if (!!this.props.navigatorChanged
      && (this.props.searchCursor !== prevProps.searchCursor
        || this.props.searchIdeas.length !== prevProps.searchIdeas.length
        || this.props.selected !== prevProps.selected)) {
      this.props.navigatorChanged();
    }
  }

  render() {
    if (!!this.props.showDrafts && !this.props.draftSearchStatus) {
      this.props.server.dispatchAdmin({ debounce: true }).then(d => d.ideaDraftSearchAdmin({
        projectId: this.props.server.getProjectId(),
        ideaDraftSearch: this.props.draftSearchMerged || {},
      }));
    }

    if (!this.props.searchStatus) {
      const loadMorePromise = this.loadMore();
      if (!!windowIso.isSsr) windowIso.awaitPromises.push(loadMorePromise);
    }

    const marginsClassName = this.props.margins === undefined
      ? this.props.classes.marginsDefault : this.props.classes.marginsSupplied;
    const hideIfEmpty = !!this.props.panel?.['hideIfEmpty'];
    const searchIdeas = !this.props.filterPosts ? this.props.searchIdeas
      : this.props.searchIdeas.filter(this.props.filterPosts);
    const hasAny = !!searchIdeas.length;
    var content;
    if (!this.props.searchStatus || this.props.searchStatus === Status.REJECTED) {
      content = (
        <div className={classNames(marginsClassName, this.props.classes.placeholder)}>
          <ErrorMsg msg='Failed to load' />
        </div>
      );
    } else if (hideIfEmpty && !hasAny) {
      return null;
    } else if (this.props.searchStatus === Status.PENDING && !hasAny) {
      content = (
        <div className={classNames(marginsClassName, this.props.classes.placeholder)}>
          <Loading />
        </div>
      );
    } else {
      if (!!this.props.onHasAnyChanged && (this.notifiedHasAnyCount !== searchIdeas.length)) {
        this.notifiedHasAnyCount = searchIdeas.length;
        this.props.onHasAnyChanged(hasAny, searchIdeas.length);
      }

      const onlyHasOneCategory = (this.props.config && this.props.config.content.categories.length <= 1
        || (this.props.panel?.search?.filterCategoryIds?.length === 1));

      const display: Client.PostDisplay = {
        titleTruncateLines: 1,
        descriptionTruncateLines: 2,
        ...(onlyHasOneCategory ? { showCategoryName: false } : {}),
        ...(this.props.displayDefaults || {}),
        ...(this.props.panel?.display || {}),
      }

      const onClickPost = (!this.props.onClickPost && !this.props.onClickPostExpand) ? undefined : postId => {
        this.props.onClickPost?.(postId);
        this.props.onClickPostExpand && this.setState({ expandedPostId: postId === this.state.expandedPostId ? undefined : postId });
      };
      content = searchIdeas.map((idea, ideaIndex) => {
        var content: React.ReactNode;
        if (this.props.renderPost) {
          content = this.props.renderPost(idea, ideaIndex);
        } else {
          const displayForThisPost = this.state.expandedPostId !== idea.ideaId ? display : {
            ...display,
            titleTruncateLines: undefined,
            descriptionTruncateLines: undefined,
          };
          content = (
            <Post
              className={classNames(
                this.props.classes.item,
                this.props.searchStatus !== Status.FULFILLED && this.props.classes.itemLoading,
                this.props.postClassName,
              )}
              classNamePadding={classNames(marginsClassName)}
              server={this.props.server}
              idea={idea}
              widthExpand={this.props.widthExpand}
              expandable
              disableOnClick={this.props.disableOnClick}
              onClickPost={onClickPost}
              onUserClick={this.props.onUserClick}
              display={displayForThisPost}
              variant='list'
              {...this.props.PostProps}
            />
          );
        }
        if (this.props.wrapPost) {
          content = this.props.wrapPost(idea, content, ideaIndex, this.props.selected === idea.ideaId);
        }
        if (this.props.selectable) {
          content = this.selectableWrapItem(idea.ideaId, content);
        } else {
          content = (
            <React.Fragment key={idea.ideaId}>
              {content}
            </React.Fragment>
          );
        }
        return content;
      });
      var drafts = this.renderDrafts(marginsClassName);
      if (drafts?.length) {
        content = [...drafts, ...content];
      }
      const itemCount = content.length;
      if (!!itemCount && this.props.selectable) {
        content = this.selectableWrapItems(content);
      }
      if (!itemCount) {
        content = (
          <>
            {content}
            {this.props.renderEmpty ? this.props.renderEmpty() : (
              <div
                className={classNames(
                  marginsClassName,
                  this.props.classes.placeholder,
                )}
              >
                <Typography variant='overline' style={{
                }}>{this.props.t('empty')}</Typography>
              </div>
            )}
          </>
        );
      }
    }
    if (this.props.searchCursor && !this.props.hideLoadMore) {
      content = (
        <>
          {content}
          <LoadMoreButton onClick={() => this.loadMore()} />
        </>
      );
    }
    const title = this.props.overrideTitle !== undefined ? this.props.overrideTitle : (!this.props.panel?.['title'] ? undefined : (
      <PanelTitle
        text={this.props.panel['title']}
        color={this.props.panel['color']}
      />
    ));
    if (title !== undefined) {
      content = this.props.suppressPanel ? (
        <>
          {title}
          {content}
        </>
      ) : (
        <Panel
          className={classNames(this.props.className)}
          title={title}
          direction={this.props.direction}
          maxHeight={this.props.maxHeight}
        >
          {this.props.preContent}
          {content}
        </Panel>
      );
    }
    return content;
  }

  renderDrafts(marginsClassName?: string): React.ReactNode[] | undefined {
    if (!this.props.showDrafts) return undefined;

    const hasAny = !!this.props.draftSearchDrafts?.length;
    var content;
    if (!this.props.searchStatus || this.props.searchStatus === Status.REJECTED) {
      content = (
        <ErrorMsg msg='Failed to load drafts' />
      );
    } else if (!hasAny) {
      content = undefined;
    } else {
      if (!this.props.draftSearchDrafts?.length) return undefined;
      content = this.props.draftSearchDrafts.map(draft => {
        var draftContent: React.ReactNode = (
          <DraftItem
            className={classNames(
              this.props.classes.item,
              this.props.searchStatus !== Status.FULFILLED && this.props.classes.itemLoading,
              marginsClassName,
            )}
            server={this.props.server}
            draft={draft}
            onClick={!this.props.showDrafts?.onClickDraft ? undefined : () => this.props.showDrafts?.onClickDraft?.(draft.draftId)}
          />
        );
        if (this.props.selectable) {
          draftContent = this.selectableWrapItem(draft.draftId, draftContent);
        } else {
          draftContent = (
            <React.Fragment key={draft.draftId}>
              {draftContent}
            </React.Fragment>
          );
        }
        return draftContent;
      });
    }
    return content;
  }

  hasPrevious(): boolean {
    if (!this.props.selected) return false;
    const selectedIndex = this.props.searchIdeas.findIndex(idea => idea.ideaId === this.props.selected);
    return selectedIndex >= 1;
  }

  getPreviousId(): string | undefined {
    if (!this.props.selected) return undefined;
    const selectedIndex = this.props.searchIdeas.findIndex(idea => idea.ideaId === this.props.selected);
    const previousPostId = this.props.searchIdeas[selectedIndex - 1]?.ideaId;
    return previousPostId;
  }

  previous(): boolean {
    if (!this.props.onClickPost) return false;
    const previousPostId = this.getPreviousId();
    if (!previousPostId) return false;
    this.props.onClickPost(previousPostId);
    return true;
  }

  hasNext(): boolean {
    if (!this.props.selected) return false;
    const selectedIndex = this.props.searchIdeas.findIndex(idea => idea.ideaId === this.props.selected);
    return selectedIndex !== -1
      && (selectedIndex < (this.props.searchIdeas.length - 1) || !!this.props.searchCursor);
  }

  async getNextId(): Promise<string | undefined> {
    if (!this.props.selected) return undefined;
    const selectedIndex = this.props.searchIdeas.findIndex(idea => idea.ideaId === this.props.selected);
    if (selectedIndex === -1) return undefined;
    var nextPostId: string | undefined;
    if (selectedIndex === (this.props.searchIdeas.length - 1)) {
      const result = await this.loadMore();
      nextPostId = result?.results[0]?.ideaId;
    } else {
      nextPostId = this.props.searchIdeas[selectedIndex + 1]?.ideaId;
    }
    return nextPostId;
  }

  async next(): Promise<boolean> {
    if (!this.props.onClickPost) return false;
    const nextPostId = await this.getNextId();
    if (!nextPostId) return false;
    this.props.onClickPost(nextPostId);
    return true;
  }

  selectableWrapItem(id: string, content: React.ReactNode): React.ReactNode {
    if (this.props.selectable === 'highlight') {
      return (
        <TabFragment key={id} value={id}>
          {content}
        </TabFragment>
      );
    }
    if (this.props.selectable === 'check') {
      return (
        <Collapse key={id} in={!this.props.selected || this.props.selected === id}>
          {content}
        </Collapse>
      );
    }
    return content;
  }

  selectableWrapItems(content: React.ReactNode): React.ReactNode {
    if (this.props.selectable === 'highlight') {
      return (
        <TabsVertical
          selected={this.props.selected || this.props.showDrafts?.selectedDraftId}
          onClick={this.props.onClickPost ? (postId => this.props.onClickPost?.(postId)) : undefined}
        >
          {content}
        </TabsVertical>
      );
    }
    return content;
  }
}


const stylesDrafts = (theme: Theme) => createStyles({
  draftContainer: {
    display: 'flex',
    flexDirection: 'column',
    width: MaxContentWidth,
    maxWidth: '100%',
  },
  draftBottomBar: {
    display: 'flex',
    alignItems: 'center',
  },
  clickable: {
    cursor: 'pointer',
    textDecoration: 'none',
  },
});
const useStylesDrafts = makeStyles(stylesDrafts);
export const DraftItem = (props: {
  className?: string;
  server: Server;
  draft: Admin.IdeaDraftAdmin;
  titleTruncateLines?: number;
  descriptionTruncateLines?: number;
  onClick?: () => void;
}) => {
  const classes = useStylesDrafts();
  const titleTruncateLines = props.titleTruncateLines !== undefined ? props.titleTruncateLines : 2;
  const descriptionTruncateLines = props.descriptionTruncateLines !== undefined ? props.descriptionTruncateLines : 3;
  return (
    <div
      className={classNames(
        props.className,
        classes.draftContainer,
        !!props.onClick && classes.clickable,
      )}
      onClick={!props.onClick ? undefined : () => props.onClick?.()}
    >
      <PostTitle
        variant='list'
        title={props.draft.title}
        titleTruncateLines={titleTruncateLines}
        descriptionTruncateLines={descriptionTruncateLines}
      />
      <PostDescription
        variant='list'
        description={props.draft.description}
        descriptionTruncateLines={descriptionTruncateLines}
      />
      <div className={classes.draftBottomBar}>
        <PostClassification title='Draft' />
      </div>
    </div>
  );
}


export default keyMapper(
  (ownProps: Props) => getSearchKey({
    ...(ownProps.panel?.search || {}),
    ...ownProps.searchOverride,
    ...ownProps.searchOverrideAdmin,
  }),
  connect<ConnectProps, {}, Props, ReduxState>(() => {
    const selectIsAdminSearch = (_, ownProps: Props): boolean => !!ownProps.searchOverrideAdmin;
    const selectSearchMerged = (_, ownProps: Props): Client.IdeaSearch | Admin.IdeaSearchAdmin => ({
      ...(ownProps.panel?.search || {}),
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

    const selectLoggedInUser = (state: ReduxState) => state.users.loggedIn.user;
    const selectMissingVotes = selectorContentWrap(createSelector(
      [selectSearch, selectVotesStatusByIdeaId, selectLoggedInUser, selectIsAdminSearch],
      (search, votesStatusByIdeaId, loggedInUser, isAdminSearch) => {
        const missing: string[] = [];
        // Don't get votes if calling admin search or not logged in
        if (isAdminSearch || !loggedInUser) return missing;
        search?.ideaIds?.forEach(ideaId => {
          if (votesStatusByIdeaId[ideaId] === undefined) {
            missing.push(ideaId);
          }
        });
        return missing.length ? missing : undefined;
      }
    ));

    const selectHideSearchResultPostIds = (_, ownProps: Props): Set<string> | undefined => ownProps.hideSearchResultPostIds;
    const selectIdeas = selectorContentWrap(createSelector(
      [selectSearch, selectIdeasById, selectHideSearchResultPostIds],
      (search, byId, hideSearchResultPostIds) => {
        const ideas = (search?.ideaIds || [])
          .filter(ideaId => !hideSearchResultPostIds?.has(ideaId))
          .map(ideaId => byId[ideaId]?.idea)
          .filter(notEmpty);
        return ideas.length ? ideas : undefined;
      }));

    // DRAFTS
    const selectDraftsSearchMerged = (_, ownProps: Props): Admin.IdeaDraftSearch => ({
      filterCategoryIds: ownProps.searchOverrideAdmin?.filterCategoryIds
        || ownProps.searchOverride?.filterCategoryIds
        || ownProps.panel?.search?.filterCategoryIds,
    });
    const selectDraftsSearchKey = createSelector(
      [selectDraftsSearchMerged],
      (searchMerged) => getSearchKey(searchMerged)
    );
    const selectDraftsBySearch = (state: ReduxState) => state.drafts.bySearch;
    const selectDraftsSearch = createSelector(
      [selectDraftsSearchKey, selectDraftsBySearch],
      (searchKey, draftsBySearch) => searchKey ? draftsBySearch[searchKey] : undefined
    );
    const selectDraftsById = (state: ReduxState) => state.drafts.byId;
    const selectDrafts = selectorContentWrap(createSelector(
      [selectDraftsSearch, selectDraftsById],
      (search, byId) => {
        const drafts = (search?.draftIds || [])
          .map(draftId => byId[draftId]?.draft)
          .filter(notEmpty);
        return drafts.length ? drafts : undefined;
      }));

    const selectConnectProps = createSelector(
      selectMissingVotes,
      selectIdeas,
      selectSearch,
      selectDraftsSearchMerged,
      selectDrafts,
      selectDraftsSearch,
      (state: ReduxState) => state.conf.ver,
      (state: ReduxState) => state.conf.conf,
      (state: ReduxState) => state.projectId,
      selectLoggedInUser,
      (missingVotes, ideas, search, draftSearchMerged, drafts, draftSearch, configver, config, projectId, loggedInUser) => {
        const connectProps: ConnectProps = {
          config,
          configver,
          searchStatus: search?.status,
          searchCursor: search?.cursor,
          searchIdeas: ideas || [],
          draftSearchMerged: draftSearchMerged,
          draftSearchStatus: draftSearch?.status,
          draftSearchCursor: draftSearch?.cursor,
          draftSearchDrafts: drafts || [],
          missingVotes,
          projectId: projectId || undefined,
          loggedInUser,
        };
        return connectProps;
      });
    return (state, ownProps) => selectConnectProps(state, ownProps);
  })(withStyles(styles, { withTheme: true })(withTranslation('app', { withRef: true })(PanelPost))));
