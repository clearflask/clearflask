import { Typography } from '@material-ui/core';
import { createStyles, makeStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
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
import { MutableRef } from '../../common/util/refUtil';
import { selectorContentWrap } from '../../common/util/reselectUtil';
import { TabFragment, TabsVertical } from '../../common/util/tabsUtil';
import ErrorMsg from '../ErrorMsg';
import Loading from '../utils/Loading';
import LoadMoreButton from './LoadMoreButton';
import Panel, { PanelTitle } from './Panel';
import Post, { MaxContentWidth, PostClassification, PostDescription, PostTitle } from './Post';

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
  widthExpandMarginSupplied: {
    padding: (props: Props) => props.widthExpandMargin,
  },
  widthExpandMargin: {
    [theme.breakpoints.only('xs')]: {
      padding: theme.spacing(2, 2),
      '&:first-child': { paddingTop: theme.spacing(4) },
      '&:last-child': { paddingBottom: theme.spacing(4) },
    },
    [theme.breakpoints.only('sm')]: {
      padding: theme.spacing(2, 2),
      '&:first-child': { paddingTop: theme.spacing(4) },
      '&:last-child': { paddingBottom: theme.spacing(4) },
    },
    [theme.breakpoints.up('md')]: {
      padding: theme.spacing(3, 4),
      '&:first-child': { paddingTop: theme.spacing(6) },
      '&:last-child': { paddingBottom: theme.spacing(6) },
    },
  },
});
const useStyles = makeStyles(styles);
export interface Props {
  className?: string;
  postClassName?: string;
  server: Server;
  panel?: Partial<Client.PagePanel | Client.PagePanelWithHideIfEmpty | Client.PageExplorer>;
  overrideTitle?: React.ReactNode;
  preContent?: React.ReactNode;
  widthExpand?: boolean;
  widthExpandMargin?: MarginProperty<string | number>;
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
  PostProps?: Partial<React.ComponentProps<typeof Post>>;
  renderPost?: (post: Client.Idea, index: number) => React.ReactNode;
  wrapPost?: (post: Client.Idea, postNode: React.ReactNode, index: number) => React.ReactNode;
  onHasAnyChanged?: (hasAny: boolean, count: number) => void;
  navigatorRef?: MutableRef<PanelPostNavigator>;
  selectable?: boolean;
  selected?: string;
  navigatorChanged?: () => void;
  showDrafts?: {
    onClickDraft?: (draftId: string) => void,
    selectedDraftId?: string;
  };
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
class PanelPost extends Component<Props & ConnectProps & WithStyles<typeof styles, true>, State> implements PanelPostNavigator {
  state: State = {};
  notifiedHasAnyCount?: number;

  constructor(props) {
    super(props);

    if (this.props.navigatorRef) this.props.navigatorRef.current = this;

    if (!!this.props.showDrafts && !this.props.draftSearchStatus) {
      this.props.server.dispatchAdmin().then(d => d.ideaDraftSearchAdmin({
        projectId: this.props.server.getProjectId(),
        ideaDraftSearch: this.props.draftSearchMerged || {},
      }));
    }

    if (!this.props.searchStatus) {
      this.loadMore();
    } else if (this.props.missingVotes?.length) {
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

  async loadMore(): Promise<undefined | Client.IdeaWithVoteSearchResponse | Admin.IdeaSearchResponse> {
    if (!this.props.projectId) return;
    if (!!this.props.searchStatus && !this.props.searchCursor) return;
    if (!this.props.searchOverrideAdmin) {
      return await (await this.props.server.dispatch({ ssr: true })).ideaSearch({
        projectId: this.props.projectId,
        ideaSearch: {
          ...(this.props.panel?.search || {}),
          ...this.props.searchOverride,
        },
        cursor: this.props.searchCursor,
      });
    } else {
      return await (await this.props.server.dispatchAdmin({ ssr: true })).ideaSearchAdmin({
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
    nested: new Set(['panel', 'displayDefaults', 'searchOverride', 'searchOverrideAdmin', 'PostProps']),
  });

  componentDidUpdate(prevProps, prevState) {
    if (!!this.props.navigatorChanged
      && (this.props.searchCursor !== prevProps.searchCursor
        || this.props.searchIdeas.length !== prevProps.searchIdeas.length
        || this.props.selected !== prevProps.selected)) {
      this.props.navigatorChanged();
    }
  }

  render() {
    const widthExpandMarginClassName = this.props.widthExpandMargin === undefined
      ? this.props.classes.widthExpandMargin : this.props.classes.widthExpandMarginSupplied;
    const hideIfEmpty = !!this.props.panel?.['hideIfEmpty'];
    const hasAny = !!this.props.searchIdeas.length;
    var content;
    if (!this.props.searchStatus || this.props.searchStatus === Status.REJECTED) {
      content = (
        <div className={classNames(this.props.widthExpand && widthExpandMarginClassName, this.props.classes.placeholder)}>
          <ErrorMsg msg='Failed to load' />
        </div>
      );
    } else if (hideIfEmpty && !hasAny) {
      return null;
    } else if (this.props.searchStatus === Status.PENDING && !hasAny) {
      content = (
        <div className={classNames(this.props.widthExpand && widthExpandMarginClassName, this.props.classes.placeholder)}>
          <Loading />
        </div>
      );
    } else {
      if (!!this.props.onHasAnyChanged && (this.notifiedHasAnyCount !== this.props.searchIdeas.length)) {
        this.notifiedHasAnyCount = this.props.searchIdeas.length;
        this.props.onHasAnyChanged(hasAny, this.props.searchIdeas.length);
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
      content = this.props.searchIdeas.map((idea, ideaIndex) => {
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
                this.props.postClassName,
              )}
              classNamePadding={classNames(
                this.props.widthExpand && widthExpandMarginClassName,
              )}
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
          content = this.props.wrapPost(idea, content, ideaIndex);
        }
        if (this.props.selectable) {
          content = (
            <TabFragment key={idea.ideaId} value={idea.ideaId}>
              {content}
            </TabFragment>
          );
        } else {
          content = (
            <React.Fragment key={idea.ideaId}>
              {content}
            </React.Fragment>
          );
        }
        return content;
      });
      var drafts = this.renderDrafts(widthExpandMarginClassName);
      if (drafts?.length) {
        content = [...drafts, ...content];
      }
      const itemCount = content.length;
      if (!!itemCount && this.props.selectable) {
        content = (
          <TabsVertical
            selected={this.props.selected || this.props.showDrafts?.selectedDraftId}
            onClick={this.props.onClickPost ? (postId => this.props.onClickPost?.(postId)) : undefined}
          >
            {content}
          </TabsVertical>
        );
      }
      if (!itemCount) {
        content = (
          <>
            {content}
            <div
              className={classNames(
                this.props.widthExpand && widthExpandMarginClassName,
                this.props.classes.placeholder,
              )}
            >
              <Typography variant='overline' style={{
              }}>Empty</Typography>
            </div>
          </>
        );
      }
    }
    if (this.props.searchCursor) {
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

  renderDrafts(widthExpandMarginClassName?: string): React.ReactNode[] | undefined {
    if (!this.props.showDrafts) return undefined;

    const hideIfEmpty = !!this.props.panel?.['hideIfEmpty'];
    var content;
    switch (this.props.searchStatus || Status.PENDING) {
      default:
      case Status.REJECTED:
        content = (
          <ErrorMsg msg='Failed to load drafts' />
        );
        break;
      case Status.PENDING:
        if (hideIfEmpty) return undefined;
        content = (
          <Loading />
        );
        break;
      case Status.FULFILLED:
        if (!this.props.draftSearchDrafts?.length) return undefined;
        content = this.props.draftSearchDrafts.map(draft => {
          var draftContent = (
            <DraftItem
              className={widthExpandMarginClassName}
              server={this.props.server}
              draft={draft}
              onClick={!this.props.showDrafts?.onClickDraft ? undefined : () => this.props.showDrafts?.onClickDraft?.(draft.draftId)}
            />
          );
          if (this.props.selectable) {
            draftContent = (
              <TabFragment key={draft.draftId} value={draft.draftId}>
                {draftContent}
              </TabFragment>
            );
          } else {
            draftContent = (
              <React.Fragment key={draft.draftId}>
                {draftContent}
              </React.Fragment>
            );
          }
          return draftContent;
        });
        break;
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
        const drafts = (search?.draftIds || []).map(draftId => {
          const draft = byId[draftId];
          if (!draft || draft.status !== Status.FULFILLED) return undefined;
          return draft.draft;
        }).filter(notEmpty);
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
  })(withStyles(styles, { withTheme: true })(PanelPost)));
