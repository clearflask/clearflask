// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
// import {
//   withQueryParams,
//   StringParam,
//   NumberParam,
//   ArrayParam,
//   withDefault,
//   DecodedValueMap,
//   SetQuery,
//   QueryParamConfig,
// } from 'use-query-params';
import { isWidthUp, Typography, withWidth, WithWidthProps } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
/** Alternatives Add, AddCircleRounded, RecordVoiceOverRounded */
import AddIcon from '@material-ui/icons/RecordVoiceOverRounded';
import classNames from 'classnames';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import { RouteComponentProps, withRouter } from 'react-router';
import * as Client from '../../api/client';
import { ReduxState, Server, StateSettings } from '../../api/server';
import { tabHoverApplyStyles } from '../../common/DropdownTab';
import InViewObserver from '../../common/InViewObserver';
import RichEditorImageUpload from '../../common/RichEditorImageUpload';
import { preserveEmbed } from '../../common/util/historyUtil';
import { textToHtml } from "../../common/util/richEditorUtil";
import { initialWidth } from '../../common/util/screenUtil';
import windowIso from '../../common/windowIso';
import { animateWrapper } from '../../site/landing/animateUtil';
import ExplorerTemplate from './ExplorerTemplate';
import LogIn from './LogIn';
import { Direction } from './Panel';
import PanelPost from './PanelPost';
import PanelSearch from './PanelSearch';
import PostCreateForm from './PostCreateForm';

const styles = (theme: Theme) => createStyles({
  root: {
    maxWidth: '100%',
  },
  fitContent: {
    width: 'fit-content',
  },
  content: {
  },
  caption: {
    margin: theme.spacing(1),
    color: theme.palette.text.secondary,
  },
  addIcon: {
    marginLeft: theme.spacing(0.5),
  },
  addIconButton: {
    padding: 2,
    marginRight: -2,
  },
  panelSearch: {
    marginBottom: -1,
  },
  createButtonShowBorder: {
    borderBottom: `1px solid ${theme.palette.type === 'light'
      // https://github.com/mui-org/material-ui/blob/master/packages/material-ui/src/Input/Input.js#L10
      ? 'rgba(0, 0, 0, 0.42)' : 'rgba(255, 255, 255, 0.7)'}`,
  },
  createButton: {
    padding: theme.spacing(1.5, 0, 0.5),
    margin: `0 auto -1px`,
    color: theme.palette.text.hint,
    minWidth: 100,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-evenly',
  },
  createButtonDashboard: {
    marginLeft: theme.spacing(2),
  },
  createButtonClickable: {
    cursor: 'pointer',
    ...(tabHoverApplyStyles(theme, 1)),
  },
});

interface Props {
  className?: string;
  server: Server;
  isDashboard?: boolean;
  explorer: Client.PageExplorer;
  createFormAdminControlsDefaultVisibility?: React.ComponentProps<typeof PostCreateForm>['adminControlsDefaultVisibility'],
  onClickPost?: (postId: string) => void;
  onUserClick?: (userId: string) => void;
}
interface ConnectProps {
  callOnMount?: () => void,
  settings: StateSettings;
}
interface State {
  createOpen?: boolean;
  search?: Partial<Client.IdeaSearch>;
  onLoggedIn?: (userId: string) => void;
  searchSimilar?: string;
  animateTitle?: string;
  animateDescription?: string;
}
// class QueryState {
//   search: QueryParamConfig<Partial<Client.IdeaSearch>> = {
//     encode: () => string;
//     decode: () => ;
//   };
// }


// const styles: (theme: Theme) => Record<"tab              Root", CSSProperties | CreateCSSProperties<{}> | PropsFunc<{}, CreateCSSProperties<{}>>>
// const styles: (theme: Theme) => Record<"createButtonClickable", CSSProperties | CreateCSSProperties<(value: JSSFontface, index: number, array: JSSFontface[]) => unknown> | PropsFunc<...>>



class IdeaExplorer extends Component<Props & ConnectProps & WithStyles<typeof styles, true> & RouteComponentProps & WithWidthProps, State> {
  state: State = {};
  readonly titleInputRef: React.RefObject<HTMLInputElement> = React.createRef();
  readonly inViewObserverRef = React.createRef<InViewObserver>();
  _isMounted: boolean = false;
  readonly richEditorImageUploadRef = React.createRef<RichEditorImageUpload>();

  constructor(props) {
    super(props);

    props.callOnMount?.();
  }

  componentDidMount() {
    this._isMounted = true;
    if (!!this.props.settings.demoCreateAnimate) {
      this.demoCreateAnimate(
        this.props.settings.demoCreateAnimate.title,
        this.props.settings.demoCreateAnimate.description,
        this.props.settings.demoCreateAnimate.similarSearchTerm,
      );
    }
  }

  componentWillUnmount() {
    this._isMounted = false;
  }

  render() {
    const isLarge = !!this.props.isDashboard;
    const createShown = !!this.state.createOpen
      || (!this.props.settings.demoDisableExplorerExpanded
        && !this.props.isDashboard
        && this.props.width && isWidthUp('md', this.props.width));
    const similarShown = createShown && !!this.state.searchSimilar;

    const search = this.props.explorer.allowSearch && (
      <PanelSearch
        className={this.props.classes.panelSearch}
        server={this.props.server}
        search={this.state.search}
        onSearchChanged={search => this.setState({ search: search })}
        explorer={this.props.explorer}
        showInitialBorder={!!this.props.isDashboard}
      />
    );
    const similarLabel = (
      <Typography variant='overline' className={this.props.classes.caption}>
        Similar
      </Typography>
    );
    var content;
    if (similarShown) {
      const searchOverride = this.state.searchSimilar ? { searchText: this.state.searchSimilar } : undefined;
      content = (
        <div className={this.props.classes.content}>
          <PanelPost
            direction={Direction.Vertical}
            panel={this.props.explorer}
            searchOverride={searchOverride}
            widthExpand
            server={this.props.server}
            onClickPost={this.props.onClickPost}
            onUserClick={this.props.onUserClick}
            suppressPanel
            displayDefaults={{
              titleTruncateLines: 1,
              descriptionTruncateLines: 2,
              responseTruncateLines: 0,
              showCommentCount: false,
              showCategoryName: false,
              showCreated: false,
              showAuthor: false,
              showStatus: false,
              showTags: false,
              showVoting: false,
              showVotingCount: false,
              showFunding: false,
              showExpression: false,
            }} />
        </div>
      );
    } else {
      content = (
        <div className={this.props.classes.content}>
          <PanelPost
            server={this.props.server}
            direction={Direction.Vertical}
            widthExpand={!this.props.isDashboard}
            onClickPost={this.props.onClickPost}
            onUserClick={this.props.onUserClick}
            panel={this.props.explorer}
            suppressPanel
            displayDefaults={{
              titleTruncateLines: 1,
              descriptionTruncateLines: 2,
              responseTruncateLines: 2,
              showCommentCount: true,
              showCreated: true,
              showAuthor: true,
              showVoting: false,
              showVotingCount: true,
              showFunding: true,
              showExpression: true,
            }}
            searchOverride={this.state.search}
          />
        </div>
      );
    }

    const createVisible = !!this.props.explorer.allowCreate && (
      <div
        className={classNames(
          this.props.classes.createButton,
          !createShown && this.props.classes.createButtonClickable,
          !!this.props.isDashboard && this.props.classes.createButtonShowBorder,
          !!this.props.isDashboard && this.props.classes.createButtonDashboard,
        )}
        onClick={createShown ? undefined : e => {
          this.setState({ createOpen: !this.state.createOpen });
          this.titleInputRef.current?.focus();
        }}
      >
        <Typography noWrap>
          {createShown
            ? (this.props.explorer.allowCreate.actionTitleLong || this.props.explorer.allowCreate.actionTitle || 'Add new post')
            : (this.props.explorer.allowCreate.actionTitle || 'Add')}
        </Typography>
        <AddIcon
          fontSize='small'
          className={this.props.classes.addIcon}
        />
      </div>
    );
    const createCollapsible = !!this.props.explorer.allowCreate && (
      <>
        <PostCreateForm
          server={this.props.server}
          type={isLarge ? 'large' : 'regular'}
          mandatoryTagIds={this.props.explorer.search.filterTagIds}
          mandatoryCategoryIds={this.props.explorer.search.filterCategoryIds}
          adminControlsDefaultVisibility={this.props.createFormAdminControlsDefaultVisibility || (this.props.isDashboard ? 'expanded' : 'hidden')}
          titleInputRef={this.titleInputRef}
          searchSimilar={(text, categoryId) => this.setState({ searchSimilar: text })}
          logInAndGetUserId={() => new Promise<string>(resolve => this.setState({ onLoggedIn: resolve }))}
          onCreated={postId => {
            if (this.props.onClickPost) {
              this.props.onClickPost(postId);
            } else {
              this.props.history.push(preserveEmbed(`/post/${postId}`, this.props.location));
            }
          }}
          defaultTitle={this.state.animateTitle}
          defaultDescription={this.state.animateDescription}
        />
        <LogIn
          actionTitle='Get notified of replies'
          server={this.props.server}
          open={!!this.state.onLoggedIn}
          onClose={() => this.setState({ onLoggedIn: undefined })}
          onLoggedInAndClose={userId => {
            if (this.state.onLoggedIn) {
              this.state.onLoggedIn(userId);
              this.setState({ onLoggedIn: undefined });
            }
          }}
        />
      </>
    );

    return (
      <InViewObserver ref={this.inViewObserverRef} disabled={!this.props.settings.demoCreateAnimate}>
        <ExplorerTemplate
          className={classNames(
            this.props.className,
            this.props.classes.root,
            !this.props.isDashboard && this.props.classes.fitContent)}
          isDashboard={this.props.isDashboard}
          createSize={this.props.explorer.allowCreate
            ? (createShown
              ? (isLarge
                ? 468 : 260)
              : 116)
            : 0}
          createShown={createShown}
          similarShown={similarShown}
          similarLabel={similarLabel}
          createVisible={createVisible}
          createCollapsible={createCollapsible}
          searchSize={this.props.explorer.allowSearch ? 120 : undefined}
          search={search}
          content={content}
        />
      </InViewObserver>
    );
  }

  async demoCreateAnimate(title: string, description?: string, searchTerm?: string) {
    const animate = animateWrapper(
      () => this._isMounted,
      this.inViewObserverRef,
      () => this.props.settings,
      this.setState.bind(this));

    if (await animate({ sleepInMs: 1000 })) return;

    for (; ;) {
      if (await animate({
        setState: {
          createOpen: true,
          ...(searchTerm ? { newItemSearchText: searchTerm } : {})
        }
      })) return;

      if (await animate({ sleepInMs: 500 })) return;

      for (var i = 0; i < title.length; i++) {
        const character = title[i];
        if (await animate({
          sleepInMs: 10 + Math.random() * 30,
          setState: { animateTitle: (this.state.animateTitle || '') + character },
        })) return;
      }

      if (description !== undefined) {
        if (await animate({ sleepInMs: 200 })) return;
        for (var j = 0; j < description.length; j++) {
          if (await animate({
            sleepInMs: 10 + Math.random() * 30,
            setState: { animateDescription: textToHtml(description.substr(0, j + 1)) },
          })) return;
        }
      }

      if (await animate({ sleepInMs: 500 })) return;

      if (description !== undefined) {
        for (var k = 0; k < description.length; k++) {
          if (await animate({
            sleepInMs: 5,
            setState: { animateDescription: textToHtml(description.substr(0, description.length - k - 1)) },
          })) return;
        }

        await new Promise(resolve => setTimeout(resolve, 100));
      }

      while (this.state.animateTitle !== undefined && this.state.animateTitle.length !== 0) {
        if (await animate({
          sleepInMs: 5,
          setState: { animateTitle: this.state.animateTitle.substr(0, this.state.animateTitle.length - 1) },
        })) return;
      }

      if (await animate({ setState: { createOpen: false } })) return;

      if (await animate({ sleepInMs: 1500 })) return;
    }
  }
}

export default connect<ConnectProps, {}, Props, ReduxState>((state, ownProps) => {
  var callOnMount;
  if (!state.conf.conf && !state.conf.status) {
    callOnMount = () => {
      ownProps.server.dispatch({ ssr: true }).then(d => {
        const slug = ownProps.server.getStore().getState().conf.conf?.slug!;
        if (windowIso.isSsr) {
          d.configBindSlug({ slug });
        } else {
          d.configAndUserBindSlug({ slug, userBind: {} });
        }
      });
    };
  }
  return {
    callOnMount: callOnMount,
    settings: state.settings,
  }
}, null, null, { forwardRef: true })(
  // withQueryParams(QueryState, 
  withStyles(styles, { withTheme: true })(withRouter(withWidth({ initialWidth })(IdeaExplorer))))
  // )
  ;
