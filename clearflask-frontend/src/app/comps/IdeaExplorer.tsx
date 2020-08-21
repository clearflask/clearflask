import { FormControl, FormHelperText, InputAdornment, isWidthUp, MenuItem, Select, TextField, Typography, withWidth, WithWidth } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import AddIcon from '@material-ui/icons/Add';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import { RouteComponentProps, withRouter } from 'react-router';
import * as Admin from '../../api/admin';
import * as Client from '../../api/client';
import { getSearchKey, ReduxState, Server, StateSettings } from '../../api/server';
import InViewObserver from '../../common/InViewObserver';
import RichEditor from '../../common/RichEditor';
import SubmitButton from '../../common/SubmitButton';
import debounce from '../../common/util/debounce';
import { rawToText, textToRaw } from '../../common/util/draftJsUtil';
import { preserveEmbed } from '../../common/util/historyUtil';
import UserSelection from '../../site/dashboard/UserSelection';
import { animateWrapper } from '../../site/landing/animateUtil';
import ExplorerTemplate from './ExplorerTemplate';
import LogIn from './LogIn';
import Panel, { Direction } from './Panel';
import PanelSearch from './PanelSearch';
import { Label } from './SelectionPicker';
import TagSelect from './TagSelect';

enum FilterType {
  Search = 'search',
  Sort = 'sort',
  Category = 'category',
  Tag = 'tag',
  Status = 'status',
}

const styles = (theme: Theme) => createStyles({
  content: {
  },
  createFormFields: {
    display: 'flex',
    flexDirection: 'column',
    // (Un)comment these to align with corner
    marginTop: theme.spacing(1),
    marginRight: theme.spacing(2),
  },
  createFormField: {
    margin: theme.spacing(1),
    width: 'auto',
    flexGrow: 1,
  },
  caption: {
    margin: theme.spacing(1),
    color: theme.palette.text.hint,
  },
  addIcon: {
    cursor: 'text',
    height: '24px',
    fontSize: '24px',
    color: theme.palette.text.hint,
  },
  panelSearch: {
    // (Un)comment these to align with corner
    marginBottom: -1,
  },
  createField: {
    minWidth: 100,
    // (Un)comment these to align with corner
    marginBottom: -1,
    marginRight: theme.spacing(3),
  },
});

interface Props {
  server: Server;
  explorer: Client.PageExplorer;
  forceDisablePostExpand?: boolean;
}

interface ConnectProps {
  configver?: string;
  config?: Client.Config;
  loggedInUserId?: string;
  settings: StateSettings;
}

interface State {
  createRefFocused?: boolean;
  newItemTitle?: string;
  newItemDescription?: string;
  newItemAuthorLabel?: Label;
  newItemChosenCategoryId?: string;
  newItemChosenTagIds?: string[];
  newItemTagSelectHasError?: boolean;
  newItemSearchText?: string;
  newItemIsSubmitting?: boolean;
  search?: Partial<Client.IdeaSearch>;
  logInOpen?: boolean;
  createFormHasExpanded?: boolean;
}

class IdeaExplorer extends Component<Props & ConnectProps & WithStyles<typeof styles, true> & RouteComponentProps & WithWidth, State> {
  readonly panelSearchRef: React.RefObject<any> = React.createRef();
  readonly createInputRef: React.RefObject<HTMLInputElement> = React.createRef();
  readonly updateSearchText: (title?: string, descRaw?: string) => void;
  readonly inViewObserverRef = React.createRef<InViewObserver>();
  _isMounted: boolean = false;

  constructor(props) {
    super(props);
    this.state = {};
    this.updateSearchText = debounce(
      (title?: string, descRaw?: string) => this.setState({
        newItemSearchText:
          `${title || ''} ${descRaw ? rawToText(descRaw) : ''}`
      }),
      1000);
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
    const createHasSpace = this.props.settings.demoForceExplorerCreateHasSpace === undefined
      ? isWidthUp('md', this.props.width)
      : this.props.settings.demoForceExplorerCreateHasSpace;
    const createActive = (!!this.state.createRefFocused && !createHasSpace)
      || !!this.state.newItemTitle
      || !!this.state.newItemDescription;
    const createShown = createActive || createHasSpace;

    var content, topBar;
    if (createActive) {
      topBar = (
        <Typography variant='overline' className={this.props.classes.caption}>
          Similar:
        </Typography>
      );
      const searchOverride = this.state.newItemSearchText ? { searchText: this.state.newItemSearchText } : undefined;
      content = (
        <div className={this.props.classes.content}>
          <Panel
            key={getSearchKey({ ...searchOverride, ...this.props.explorer.search })}
            direction={Direction.Vertical}
            panel={this.props.explorer}
            searchOverride={searchOverride}
            forceDisablePostExpand={this.props.forceDisablePostExpand}
            server={this.props.server}
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
      topBar = this.props.explorer.allowSearch && (
        <PanelSearch
          className={this.props.classes.panelSearch}
          innerRef={this.panelSearchRef}
          server={this.props.server}
          search={this.state.search}
          onSearchChanged={search => this.setState({ search: search })}
          explorer={this.props.explorer}
        />
      );
      content = (
        <div className={this.props.classes.content}>
          <Panel
            key={getSearchKey(this.props.explorer.search)}
            server={this.props.server}
            direction={Direction.Vertical}
            forceDisablePostExpand={this.props.forceDisablePostExpand}
            panel={this.props.explorer}
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
            {...(this.props.explorer.allowSearch ? {
              onClickTag: this.panelSearchRef.current && this.panelSearchRef.current.isFilterControllable(FilterType.Tag)
                ? tagId => this.panelSearchRef.current && this.panelSearchRef.current.onClickTag(tagId) : undefined,
              onClickStatus: this.panelSearchRef.current && this.panelSearchRef.current.isFilterControllable(FilterType.Status)
                ? statusId => this.panelSearchRef.current && this.panelSearchRef.current.onClickStatus(statusId) : undefined,
              onClickCategory: this.panelSearchRef.current && this.panelSearchRef.current.isFilterControllable(FilterType.Category)
                ? categoryId => this.panelSearchRef.current && this.panelSearchRef.current.onClickCategory(categoryId) : undefined,
            } : {})}
          />
        </div>
      );
    }

    const createVisible = !!this.props.explorer.allowCreate && (
      <TextField
        disabled={this.state.newItemIsSubmitting}
        className={`${this.props.classes.createFormField} ${this.props.classes.createField}`}
        placeholder={createShown
          ? (this.props.explorer.allowCreate.actionTitleLong || this.props.explorer.allowCreate.actionTitle || 'Add new post')
          : (this.props.explorer.allowCreate.actionTitle || 'Add')}
        value={this.state.newItemTitle || ''}
        onChange={e => {
          this.updateSearchText(e.target.value, this.state.newItemDescription);
          this.setState({
            newItemTitle: e.target.value,
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
          })
        }}
        InputProps={{
          inputRef: this.createInputRef,
          onBlur: () => this.setState({ createRefFocused: false }),
          onFocus: () => this.setState({ createRefFocused: true }),
          endAdornment: (
            <InputAdornment position="end">
              <AddIcon
                className={this.props.classes.addIcon}
                onClick={() => this.createInputRef.current?.focus()}
              />
            </InputAdornment>
          ),
        }}
      />
    );
    const createCollapsible = !!this.props.explorer.allowCreate && this.renderCreate();

    return (
      <InViewObserver ref={this.inViewObserverRef}>
        <ExplorerTemplate
          createSize={this.props.explorer.allowCreate ? (createShown ? 300 : 116) : 0}
          createShown={createShown}
          createVisible={createVisible}
          createCollapsible={createCollapsible}
          searchSize={this.props.explorer.allowSearch ? 100 : undefined}
          search={topBar}
          content={content}
        />
      </InViewObserver>
    );
  }

  renderCreate() {
    if (!this.props.config
      || this.props.config.content.categories.length === 0) return null;

    var categoryOptions = (this.props.explorer.search.filterCategoryIds && this.props.explorer.search.filterCategoryIds.length > 0)
      ? this.props.config.content.categories.filter(c => this.props.explorer.search.filterCategoryIds!.includes(c.categoryId))
      : this.props.config.content.categories;
    if (!this.props.server.isModLoggedIn()) categoryOptions = categoryOptions.filter(c => c.userCreatable);
    if (this.state.newItemChosenCategoryId === undefined && categoryOptions.length === 1) {
      this.setState({ newItemChosenCategoryId: categoryOptions[0].categoryId })
    }
    const selectedCategory = categoryOptions.find(c => c.categoryId === this.state.newItemChosenCategoryId);
    const enableSubmit = this.state.newItemTitle && this.state.newItemChosenCategoryId && !this.state.newItemTagSelectHasError;
    const mandatoryTagIds = this.props.explorer.search.filterTagIds || [];
    return (
      <div className={this.props.classes.createFormFields}>
        <RichEditor
          id='createDescription'
          disabled={this.state.newItemIsSubmitting}
          className={this.props.classes.createFormField}
          placeholder='Description'
          value={this.state.newItemDescription || ''}
          onChange={e => {
            this.updateSearchText(this.state.newItemTitle, e.target.value);
            this.setState({ newItemDescription: e.target.value })
          }}
          multiline
          rows={1}
          rowsMax={5}
        />
        {this.props.server.isModLoggedIn() && (
          <UserSelection
            server={this.props.server}
            className={this.props.classes.createFormField}
            disabled={this.state.newItemIsSubmitting}
            onChange={selectedUserLabel => this.setState({ newItemAuthorLabel: selectedUserLabel })}
            allowCreate
          />
        )}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
        }}>
          {categoryOptions.length > 1 && (
            <FormControl
              className={this.props.classes.createFormField}
              error={!selectedCategory}
            >
              <Select
                disabled={this.state.newItemIsSubmitting}
                value={selectedCategory ? selectedCategory.categoryId : ''}
                onChange={e => this.setState({ newItemChosenCategoryId: e.target.value as string })}
              >
                {categoryOptions.map(categoryOption => (
                  <MenuItem key={categoryOption.categoryId} value={categoryOption.categoryId}>{categoryOption.name}</MenuItem>
                ))}
              </Select>
              <FormHelperText>
                {!selectedCategory ? 'Choose a category' : ' '}
              </FormHelperText>
            </FormControl>
          )}
          {selectedCategory && (
            <div className={this.props.classes.createFormField}>
              <TagSelect
                placeholder='Tags'
                category={selectedCategory}
                tagIds={this.state.newItemChosenTagIds}
                onChange={tagIds => this.setState({ newItemChosenTagIds: tagIds })}
                onErrorChange={(hasError) => this.setState({ newItemTagSelectHasError: hasError })}
                disabled={this.state.newItemIsSubmitting}
                mandatoryTagIds={mandatoryTagIds}
              />
            </div>
          )}
        </div>
        <SubmitButton
          color='primary'
          isSubmitting={this.state.newItemIsSubmitting}
          disabled={!enableSubmit || this.state.newItemIsSubmitting}
          onClick={e => enableSubmit && this.createClickSubmit(mandatoryTagIds)}
          style={{
            alignSelf: 'flex-end',
          }}
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
      </div>
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
    if (!!this.state.newItemAuthorLabel) {
      createPromise = this.props.server.dispatchAdmin().then(d => d.ideaCreateAdmin({
        projectId: this.props.server.getProjectId(),
        ideaCreateAdmin: {
          authorUserId: this.state.newItemAuthorLabel!.value,
          title: this.state.newItemTitle!,
          description: this.state.newItemDescription,
          categoryId: this.state.newItemChosenCategoryId!,
          tagIds: [...mandatoryTagIds, ...(this.state.newItemChosenTagIds || [])],
        },
      }))
    } else {
      createPromise = this.props.server.dispatch().ideaCreate({
        projectId: this.props.server.getProjectId(),
        ideaCreate: {
          authorUserId: this.props.loggedInUserId!,
          title: this.state.newItemTitle!,
          description: this.state.newItemDescription,
          categoryId: this.state.newItemChosenCategoryId!,
          tagIds: [...mandatoryTagIds, ...(this.state.newItemChosenTagIds || [])],
        },
      })
    }
    createPromise.then(idea => {
      this.setState({
        newItemTitle: undefined,
        newItemDescription: undefined,
        newItemChosenCategoryId: undefined,
        newItemChosenTagIds: undefined,
        newItemSearchText: undefined,
        newItemIsSubmitting: false,
      });
      this.props.history.push(preserveEmbed(`/post/${idea.ideaId}`, this.props.location));
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
      if (await animate({ sleepInMs: 1500 })) return;

      if (searchTerm) {
        if (await animate({ setState: { newItemSearchText: searchTerm } })) return;
      }

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
            setState: { newItemDescription: textToRaw(description.substr(0, j + 1)) },
          })) return;
        }
      }

      if (await animate({ sleepInMs: 500 })) return;

      if (description !== undefined) {
        for (var k = 0; k < description.length; k++) {
          if (await animate({
            sleepInMs: 5,
            setState: { newItemDescription: textToRaw(description.substr(0, description.length - k - 1)) },
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
    }
  }
}

export default connect<ConnectProps, {}, Props, ReduxState>((state, ownProps) => {
  if (!state.conf.conf && !state.conf.status) {
    ownProps.server.dispatch().configGetAndUserBind({ projectId: ownProps.server.getProjectId(), configGetAndUserBind: {} });
  }
  return {
    configver: state.conf.ver, // force rerender on config change
    config: state.conf.conf,
    loggedInUserId: state.users.loggedIn.user ? state.users.loggedIn.user.userId : undefined,
    settings: state.settings,
  }
}, null, null, { forwardRef: true })(withStyles(styles, { withTheme: true })(withRouter(withWidth()(IdeaExplorer))));
