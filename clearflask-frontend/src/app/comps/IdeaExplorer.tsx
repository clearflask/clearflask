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
import loadable from '@loadable/component';
import { Button, Collapse, FormControlLabel, Grid, isWidthUp, Switch, TextField, Typography, withWidth, WithWidthProps } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
/** Alternatives Add, AddCircleRounded, RecordVoiceOverRounded */
import AddIcon from '@material-ui/icons/RecordVoiceOverRounded';
import classNames from 'classnames';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import { RouteComponentProps, withRouter } from 'react-router';
import * as Admin from '../../api/admin';
import * as Client from '../../api/client';
import { ReduxState, Server, StateSettings } from '../../api/server';
import { tabHoverApplyStyles } from '../../common/DropdownTab';
import InViewObserver from '../../common/InViewObserver';
import RichEditorImageUpload from '../../common/RichEditorImageUpload';
import SubmitButton from '../../common/SubmitButton';
import debounce, { SimilarTypeDebounceTime } from '../../common/util/debounce';
import { preserveEmbed } from '../../common/util/historyUtil';
import { textToHtml } from "../../common/util/richEditorUtil";
import { initialWidth } from '../../common/util/screenUtil';
import windowIso from '../../common/windowIso';
import { importFailed, importSuccess } from '../../Main';
import UserSelection from '../../site/dashboard/UserSelection';
import { animateWrapper } from '../../site/landing/animateUtil';
import Loading from '../utils/Loading';
import CategorySelect from './CategorySelect';
import ExplorerTemplate from './ExplorerTemplate';
import LogIn from './LogIn';
import { Direction } from './Panel';
import PanelPost from './PanelPost';
import PanelSearch from './PanelSearch';
import { Label } from './SelectionPicker';
import StatusSelect from './StatusSelect';
import TagSelect from './TagSelect';

/** If changed, also change in Sanitizer.java */
export const PostTitleMaxLength = 100

const RichEditor = loadable(() => import(/* webpackChunkName: "RichEditor", webpackPrefetch: true */'../../common/RichEditor').then(importSuccess).catch(importFailed), { fallback: (<Loading />), ssr: false });

const styles = (theme: Theme) => createStyles({
  root: {
    maxWidth: '100%',
  },
  fitContent: {
    width: 'fit-content',
  },
  content: {
  },
  createFormFields: {
    // (Un)comment these to align with corner
    padding: theme.spacing(1, 2, 2, 0),
  },
  createFormField: {
    margin: theme.spacing(1),
    width: '100%',
  },
  createGridItem: {
    padding: theme.spacing(0, 1),
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
  descriptionLarge: {
    '& .ql-container': {
      minHeight: 60,
    }
  },
});

interface Props {
  className?: string;
  server: Server;
  isDashboard?: boolean;
  explorer: Client.PageExplorer;
  forceDisablePostExpand?: boolean;
  onClickPost?: (postId: string) => void;
  onUserClick?: (userId: string) => void;
}
interface ConnectProps {
  callOnMount?: () => void,
  configver?: string;
  config?: Client.Config;
  loggedInUserId?: string;
  settings: StateSettings;
}
interface State {
  createOpen?: boolean;
  newItemTitle?: string;
  newItemDescription?: string;
  newItemDescriptionTextOnly?: string;
  newItemAuthorLabel?: Label;
  newItemChosenCategoryId?: string;
  newItemChosenTagIds?: string[];
  newItemChosenStatusId?: string;
  newItemNotifySubscribers?: boolean;
  newItemNotifyTitle?: string;
  newItemNotifyBody?: string;
  newItemTagSelectHasError?: boolean;
  newItemSearchText?: string;
  newItemIsSubmitting?: boolean;
  search?: Partial<Client.IdeaSearch>;
  logInOpen?: boolean;
  adminControlsExpanded?: boolean;
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
  readonly panelSearchRef: React.RefObject<any> = React.createRef();
  readonly createInputRef: React.RefObject<HTMLInputElement> = React.createRef();
  readonly updateSearchText: (title?: string, descRaw?: string) => void;
  readonly inViewObserverRef = React.createRef<InViewObserver>();
  _isMounted: boolean = false;
  readonly richEditorImageUploadRef = React.createRef<RichEditorImageUpload>();

  constructor(props) {
    super(props);

    this.state = {
      adminControlsExpanded: props.isDashboard,
    };

    props.callOnMount?.();
    this.updateSearchText = debounce(
      (title?: string, descTextOnly?: string) => !!title && !!descTextOnly && this.setState({
        newItemSearchText:
          `${title || ''} ${descTextOnly || ''}`.slice(0, 30),
      }),
      SimilarTypeDebounceTime);
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
    const similarShown = createShown && (!!this.state.newItemTitle || !!this.state.newItemDescription);

    const search = this.props.explorer.allowSearch && (
      <PanelSearch
        className={this.props.classes.panelSearch}
        innerRef={this.panelSearchRef}
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
      const searchOverride = this.state.newItemSearchText ? { searchText: this.state.newItemSearchText } : undefined;
      content = (
        <div className={this.props.classes.content}>
          <PanelPost
            direction={Direction.Vertical}
            panel={this.props.explorer}
            searchOverride={searchOverride}
            widthExpand
            forceDisablePostExpand={true}
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
            showDivider={!!this.props.isDashboard}
            forceDisablePostExpand={this.props.forceDisablePostExpand}
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
              showVoting: true,
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
          this.setState({
            createOpen: !this.state.createOpen,
            ...(this.state.newItemChosenCategoryId === undefined
              ? {
                newItemChosenCategoryId: (this.state.search && this.state.search.filterCategoryIds && this.state.search.filterCategoryIds.length > 0)
                  ? this.state.search.filterCategoryIds[0]
                  : ((this.props.explorer.search.filterCategoryIds && this.props.explorer.search.filterCategoryIds.length > 0)
                    ? this.props.explorer.search.filterCategoryIds[0]
                    : undefined)
              }
              : {}),
            ...(this.state.newItemChosenTagIds === undefined ? {
              newItemChosenTagIds: [...new Set([
                ...(this.state.search && this.state.search.filterTagIds || []),
                ...(this.props.explorer.search.filterTagIds || [])])]
            } : {}),
          });
          this.createInputRef.current?.focus();
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
    const createCollapsible = !!this.props.explorer.allowCreate && this.renderCreate(isLarge);

    return (
      <InViewObserver ref={this.inViewObserverRef}>
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

  static getDerivedStateFromProps(props: React.ComponentProps<typeof IdeaExplorer>, state: State): Partial<State> | null {
    if (state.newItemChosenCategoryId === undefined) {
      const categoryOptions = IdeaExplorer.getCategoryOptions(props);
      if (categoryOptions.length > 0) {
        return {
          newItemChosenCategoryId: categoryOptions[0].categoryId,
        };
      }
    }
    return null;
  }

  renderCreate(isLarge: boolean) {
    const isModOrAdminLoggedIn = this.props.server.isModOrAdminLoggedIn();
    if (!this.props.config
      || this.props.config.content.categories.length === 0) return null;

    const categoryOptions = IdeaExplorer.getCategoryOptions(this.props);
    const selectedCategory = categoryOptions.find(c => c.categoryId === this.state.newItemChosenCategoryId);
    const enableSubmit = this.state.newItemTitle && this.state.newItemChosenCategoryId && !this.state.newItemTagSelectHasError;
    const mandatoryTagIds = this.props.explorer.search.filterTagIds || [];
    return (
      <Grid
        container
        justify={isLarge ? 'flex-end' : undefined}
        alignItems='flex-start'
        className={this.props.classes.createFormFields}
      >
        <Grid item xs={isLarge ? 9 : 12} className={this.props.classes.createGridItem}>
          <TextField
            variant='outlined'
            size='small'
            id='createTitle'
            disabled={this.state.newItemIsSubmitting}
            className={this.props.classes.createFormField}
            label='Title'
            value={this.state.newItemTitle || ''}
            onChange={e => {
              if (this.state.newItemTitle === e.target.value) {
                return;
              }
              this.updateSearchText(e.target.value, this.state.newItemDescriptionTextOnly);
              this.setState({ newItemTitle: e.target.value })
            }}
            InputProps={{
              inputRef: this.createInputRef,
            }}
            inputProps={{
              maxLength: PostTitleMaxLength,
            }}
          />
        </Grid>
        {isLarge && (
          <Grid item xs={3} className={this.props.classes.createGridItem} />
        )}
        <Grid item xs={12} className={this.props.classes.createGridItem}>
          <RichEditor
            onUploadImage={(file) => this.richEditorImageUploadRef.current?.onUploadImage(file)}
            variant='outlined'
            size='small'
            id='createDescription'
            multiline
            showControlsImmediately={isLarge}
            disabled={this.state.newItemIsSubmitting}
            className={classNames(this.props.classes.createFormField, isLarge && this.props.classes.descriptionLarge)}
            label='Details'
            iAgreeInputIsSanitized
            value={this.state.newItemDescription || ''}
            onChange={(e, delta, source, editor) => {
              const value = e.target.value;
              if (this.state.newItemDescription === value
                || (!this.state.newItemDescription && !value)) {
                return;
              }
              const descriptionTextOnly = editor.getText();
              this.updateSearchText(this.state.newItemTitle, descriptionTextOnly);
              this.setState({
                newItemDescription: value,
                newItemDescriptionTextOnly: descriptionTextOnly,
              })
            }}
          />
          <RichEditorImageUpload
            ref={this.richEditorImageUploadRef}
            server={this.props.server}
            asAuthorId={this.state.newItemAuthorLabel?.value}
          />
        </Grid>
        {categoryOptions.length > 1 && (
          <Grid item xs={isLarge ? 6 : 12} className={this.props.classes.createGridItem}>
            <CategorySelect
              variant='outlined'
              size='small'
              label='Category'
              className={this.props.classes.createFormField}
              categoryOptions={categoryOptions}
              value={selectedCategory?.categoryId || ''}
              onChange={categoryId => this.setState({ newItemChosenCategoryId: categoryId })}
              errorText={!selectedCategory ? 'Choose a category' : undefined}
              disabled={this.state.newItemIsSubmitting}
            />
          </Grid>
        )}
        {!!this.state.adminControlsExpanded && isModOrAdminLoggedIn && !!selectedCategory?.workflow.statuses.length && (
          <Grid item xs={isLarge ? 6 : 12} className={this.props.classes.createGridItem}>
            <div className={this.props.classes.createFormField}>
              <StatusSelect
                statuses={selectedCategory?.workflow.statuses || []}
                variant='outlined'
                size='small'
                disabled={this.state.newItemIsSubmitting}
                value={this.state.newItemChosenStatusId || selectedCategory.workflow.entryStatus}
                onChange={(statusId) => this.setState({ newItemChosenStatusId: statusId })}
              />
            </div>
          </Grid>
        )}
        {!!selectedCategory && (
          <TagSelect
            wrapper={(children) => (
              <Grid item xs={isLarge ? 6 : 12} className={this.props.classes.createGridItem}>
                <div className={this.props.classes.createFormField}>
                  {children}
                </div>
              </Grid>
            )}
            variant='outlined'
            size='small'
            label='Tags'
            category={selectedCategory}
            tagIds={this.state.newItemChosenTagIds}
            isModOrAdminLoggedIn={isModOrAdminLoggedIn}
            onChange={tagIds => this.setState({ newItemChosenTagIds: tagIds })}
            onErrorChange={(hasError) => this.setState({ newItemTagSelectHasError: hasError })}
            disabled={this.state.newItemIsSubmitting}
            mandatoryTagIds={mandatoryTagIds}
            SelectionPickerProps={{
              limitTags: 1,
            }}
          />
        )}
        {!!this.state.adminControlsExpanded && isModOrAdminLoggedIn && (
          <Grid item xs={isLarge ? 6 : 12} className={this.props.classes.createGridItem} justify='flex-end'>
            <UserSelection
              variant='outlined'
              size='small'
              server={this.props.server}
              label='As user'
              errorMsg='Select author'
              width='100%'
              className={this.props.classes.createFormField}
              disabled={this.state.newItemIsSubmitting}
              suppressInitialOnChange
              onChange={selectedUserLabel => this.setState({ newItemAuthorLabel: selectedUserLabel })}
              allowCreate
            />
          </Grid>
        )}
        {!!this.state.adminControlsExpanded && isModOrAdminLoggedIn && !!selectedCategory?.subscription && (
          <React.Fragment>
            <Grid item xs={12} className={this.props.classes.createGridItem}>
              <FormControlLabel
                disabled={this.state.newItemIsSubmitting}
                control={(
                  <Switch
                    checked={!!this.state.newItemNotifySubscribers}
                    onChange={(e, checked) => this.setState({
                      newItemNotifySubscribers: !this.state.newItemNotifySubscribers,
                      ...(!this.state.newItemNotifyTitle ? { newItemNotifyTitle: `New ${selectedCategory.name}` } : undefined),
                      ...(!this.state.newItemNotifyBody ? { newItemNotifyBody: `Check out my new ${selectedCategory.name}: ${this.state.newItemTitle || 'My title here'}` } : undefined),
                    })}
                    color='primary'
                  />
                )}
                label='Notify all subscribers'
              />
            </Grid>
            <Collapse in={!!this.state.newItemNotifySubscribers}>
              <Grid item xs={12} className={this.props.classes.createGridItem}>
                <TextField
                  variant='outlined'
                  size='small'
                  id='createTitle'
                  disabled={this.state.newItemIsSubmitting}
                  className={this.props.classes.createFormField}
                  label='Notification Title'
                  value={this.state.newItemNotifyTitle || ''}
                  onChange={e => this.setState({ newItemNotifyTitle: e.target.value })}
                  InputProps={{
                    inputRef: this.createInputRef,
                  }}
                  inputProps={{
                    maxLength: PostTitleMaxLength,
                  }}
                />
              </Grid>
              <Grid item xs={12} className={this.props.classes.createGridItem}>
                <TextField
                  variant='outlined'
                  size='small'
                  id='createTitle'
                  disabled={this.state.newItemIsSubmitting}
                  className={this.props.classes.createFormField}
                  label='Notification Body'
                  value={this.state.newItemNotifyBody || ''}
                  onChange={e => this.setState({ newItemNotifyBody: e.target.value })}
                  InputProps={{
                    inputRef: this.createInputRef,
                  }}
                  inputProps={{
                    maxLength: PostTitleMaxLength,
                  }}
                />
              </Grid>
            </Collapse>
          </React.Fragment>
        )}
        {isLarge && (
          <Grid item xs={6} className={this.props.classes.createGridItem} />
        )}
        <Grid item xs={isLarge ? 6 : 12} container justify='flex-end' className={this.props.classes.createGridItem}>
          <Grid item>
            {!!isModOrAdminLoggedIn && !this.state.adminControlsExpanded && (
              <Button
                onClick={e => this.setState({ adminControlsExpanded: true })}
              >
                More
              </Button>
            )}
            <SubmitButton
              color='primary'
              isSubmitting={this.state.newItemIsSubmitting}
              disabled={!enableSubmit || this.state.newItemIsSubmitting}
              onClick={e => enableSubmit && this.createClickSubmit(mandatoryTagIds)}
            >
              Submit
            </SubmitButton>
            <LogIn
              actionTitle='Get notified of replies'
              server={this.props.server}
              open={this.state.logInOpen}
              onClose={() => this.setState({ logInOpen: false })}
              onLoggedInAndClose={() => {
                this.setState({ logInOpen: false });
                this.createSubmit(mandatoryTagIds)
              }}
            />
          </Grid>
        </Grid>
      </Grid>
    );
  }

  createClickSubmit(mandatoryTagIds: string[]) {
    if (!!this.state.newItemAuthorLabel || !!this.props.loggedInUserId) {
      this.createSubmit(mandatoryTagIds);
    } else {
      // open log in page, submit on success
      this.setState({ logInOpen: true })
    }
  }

  createSubmit(mandatoryTagIds: string[]) {
    this.setState({ newItemIsSubmitting: true });
    var createPromise: Promise<Client.Idea | Admin.Idea>;
    if (this.props.server.isModOrAdminLoggedIn()) {
      createPromise = this.props.server.dispatchAdmin().then(d => d.ideaCreateAdmin({
        projectId: this.props.server.getProjectId(),
        ideaCreateAdmin: {
          authorUserId: this.state.newItemAuthorLabel?.value || this.props.loggedInUserId!,
          title: this.state.newItemTitle!,
          description: this.state.newItemDescription,
          categoryId: this.state.newItemChosenCategoryId!,
          statusId: this.state.newItemChosenStatusId,
          notifySubscribers: !this.state.newItemNotifySubscribers ? undefined : {
            title: this.state.newItemNotifyTitle!,
            body: this.state.newItemNotifyBody!,
          },
          tagIds: [...mandatoryTagIds, ...(this.state.newItemChosenTagIds || [])],
        },
      }))
    } else {
      createPromise = this.props.server.dispatch().then(d => d.ideaCreate({
        projectId: this.props.server.getProjectId(),
        ideaCreate: {
          authorUserId: this.state.newItemAuthorLabel?.value || this.props.loggedInUserId!,
          title: this.state.newItemTitle!,
          description: this.state.newItemDescription,
          categoryId: this.state.newItemChosenCategoryId!,
          tagIds: [...mandatoryTagIds, ...(this.state.newItemChosenTagIds || [])],
        },
      }));
    }
    createPromise.then(idea => {
      this.setState({
        newItemTitle: undefined,
        newItemDescription: undefined,
        newItemDescriptionTextOnly: undefined,
        newItemSearchText: undefined,
        newItemIsSubmitting: false,
      });
      if (this.props.onClickPost) {
        this.props.onClickPost(idea.ideaId);
      } else {
        this.props.history.push(preserveEmbed(`/post/${idea.ideaId}`, this.props.location));
      }
    }).catch(e => this.setState({
      newItemIsSubmitting: false,
    }));
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
          setState: { newItemTitle: (this.state.newItemTitle || '') + character },
        })) return;
      }

      if (description !== undefined) {
        if (await animate({ sleepInMs: 200 })) return;
        for (var j = 0; j < description.length; j++) {
          if (await animate({
            sleepInMs: 10 + Math.random() * 30,
            setState: { newItemDescription: textToHtml(description.substr(0, j + 1)) },
          })) return;
        }
      }

      if (await animate({ sleepInMs: 500 })) return;

      if (description !== undefined) {
        for (var k = 0; k < description.length; k++) {
          if (await animate({
            sleepInMs: 5,
            setState: { newItemDescription: textToHtml(description.substr(0, description.length - k - 1)) },
          })) return;
        }

        await new Promise(resolve => setTimeout(resolve, 100));
      }

      while (this.state.newItemTitle !== undefined && this.state.newItemTitle.length !== 0) {
        if (await animate({
          sleepInMs: 5,
          setState: { newItemTitle: this.state.newItemTitle.substr(0, this.state.newItemTitle.length - 1) },
        })) return;
      }

      if (await animate({ setState: { createOpen: false } })) return;

      if (await animate({ sleepInMs: 1500 })) return;
    }
  }

  static getCategoryOptions(props: React.ComponentProps<typeof IdeaExplorer>): Client.Category[] {
    var categoryOptions = ((props.explorer.search.filterCategoryIds && props.explorer.search.filterCategoryIds.length > 0)
      ? props.config?.content.categories.filter(c => props.explorer.search.filterCategoryIds!.includes(c.categoryId))
      : props.config?.content.categories) || [];
    if (!props.server.isModOrAdminLoggedIn()) categoryOptions = categoryOptions.filter(c => c.userCreatable);
    return categoryOptions;
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
    configver: state.conf.ver, // force rerender on config change
    config: state.conf.conf,
    loggedInUserId: state.users.loggedIn.user ? state.users.loggedIn.user.userId : undefined,
    settings: state.settings,
  }
}, null, null, { forwardRef: true })(
  // withQueryParams(QueryState, 
  withStyles(styles, { withTheme: true })(withRouter(withWidth({ initialWidth })(IdeaExplorer))))
  // )
  ;
