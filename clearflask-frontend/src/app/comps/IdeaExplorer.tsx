import React, { Component } from 'react';
import { Server, getSearchKey, ReduxState } from '../../api/server';
import { withStyles, Theme, createStyles, WithStyles } from '@material-ui/core/styles';
import * as Client from '../../api/client';
import * as Admin from '../../api/admin';
import Panel, { Direction } from './Panel';
import { Typography, TextField, Grow, Button, Select, MenuItem, FormControl, FormHelperText, InputAdornment, IconButton } from '@material-ui/core';
import { connect } from 'react-redux';
import PanelSearch from './PanelSearch';
import SelectionPicker, { ColorLookup, Label } from './SelectionPicker';
import LogIn from './LogIn';
import debounce from '../../common/util/debounce';
import { withRouter, RouteComponentProps } from 'react-router';
import UserSelection from '../../site/dashboard/UserSelection';
import ServerAdmin from '../../api/serverAdmin';
import ExplorerTemplate from './ExplorerTemplate';
import AddIcon from '@material-ui/icons/Add';

enum FilterType {
  Search = 'search',
  Sort = 'sort',
  Category = 'category',
  Tag = 'tag',
  Status = 'status',
}

interface TagSelection {
  values:Label[];
  options:Label[];
  mandatoryTagIds:string[];
  colorLookup:ColorLookup;
  error?:string;
}

const styles = (theme:Theme) => createStyles({
  content: {
    margin: theme.spacing(2),
  },
  createFormFields: {
    display: 'flex',
    flexDirection: 'column',
    // Uncomment these to align with corner
    // marginTop: theme.spacing(1),
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
  menuContainer: {
    margin: theme.spacing(2),
  },
  menuItem: {
    display: 'inline-block',
    width: '100%',
    webkitColumnBreakInside: 'avoid',
    pageBreakInside: 'avoid',
    breakInside: 'avoid',
  },
  addIcon: {
    cursor: 'text',
    height: '24px',
    fontSize: '24px',
    color: theme.palette.text.hint,
  },
  panelSearch: {
    // Uncomment these to align with corner
    // marginBottom: -1,
  },
  createField: {
    minWidth: 100,
    // Uncomment these to align with corner
    // marginBottom: -1,
    marginRight: theme.spacing(3),
  },
});

interface Props {
  server:Server;
  explorer:Client.PageExplorer;
}

interface ConnectProps {
  configver?:string;
  config?:Client.Config;
  loggedInUserId?:string;
}

interface State {
  createRefFocused?:boolean;
  newItemTitle?:string;
  newItemDescription?:string;
  newItemAuthorLabel?:Label;
  newItemChosenCategoryId?:string;
  newItemChosenTagIds?:string[];
  newItemSearchText?:string;
  newItemIsSubmitting?:boolean;
  search?:Partial<Client.IdeaSearch>;
  logInOpen?:boolean;
  createFormHasExpanded?:boolean;
}

class Explorer extends Component<Props&ConnectProps&WithStyles<typeof styles, true>&RouteComponentProps, State> {
  readonly panelSearchRef:React.RefObject<any> = React.createRef();
  readonly panelSearchInputRef:React.RefObject<HTMLInputElement> = React.createRef();
  readonly updateSearchText:(title?:string,desc?:string)=>void;

  constructor(props) {
    super(props);
    this.state = {};
    this.updateSearchText = debounce(
      (title?:string,desc?:string)=>this.setState({newItemSearchText: 
        `${title || ''} ${desc || ''}`}),
      1000);
  }

  render() {
    const expand = !!this.state.createRefFocused || !!this.state.newItemTitle || !!this.state.newItemDescription;

    var content, topBar;
    if(expand) {
      topBar = (
        <Typography variant='overline' className={this.props.classes.caption}>
          Similar:
        </Typography>
        );
      content = (
        <div className={this.props.classes.content}>
          <Panel
            key={getSearchKey(this.props.explorer.panel.search)}
            direction={Direction.Vertical}
            panel={this.props.explorer.panel}
            searchOverride={{searchText: this.state.newItemSearchText}}
            server={this.props.server}
            displayDefaults={{
              titleTruncateLines: 1,
              descriptionTruncateLines: 2,
              showDescription: true,
              showResponse: false,
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
          panel={this.props.explorer.panel}
        />
      );
      content = (
        <div className={this.props.classes.content}>
          <Panel
            key={getSearchKey(this.props.explorer.panel.search)}
            server={this.props.server}
            direction={Direction.Vertical}
            panel={this.props.explorer.panel}
            displayDefaults={{
              titleTruncateLines: 1,
              descriptionTruncateLines: 2,
              showDescription: true,
              showResponse: true,
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

    const createVisible = this.props.explorer.allowCreate && (
      <TextField
        disabled={this.state.newItemIsSubmitting}
        className={`${this.props.classes.createFormField} ${this.props.classes.createField}`}
        label='Create'
        placeholder='Title'
        value={this.state.newItemTitle || ''}
        onChange={e => {
          this.updateSearchText(e.target.value, this.state.newItemDescription);
          this.setState({
          newItemTitle: e.target.value,
          ...(this.state.newItemChosenCategoryId === undefined
            ? {newItemChosenCategoryId: (this.state.search && this.state.search.filterCategoryIds && this.state.search.filterCategoryIds.length > 0)
              ? this.state.search.filterCategoryIds[0]
              : ((this.props.explorer.panel.search.filterCategoryIds && this.props.explorer.panel.search.filterCategoryIds.length > 0)
                ? this.props.explorer.panel.search.filterCategoryIds[0]
                : undefined)}
            : {}),
          ...(this.state.newItemChosenTagIds === undefined ? {newItemChosenTagIds: [...new Set([
            ...(this.state.search && this.state.search.filterTagIds || []),
            ...(this.props.explorer.panel.search.filterTagIds || [])])]} : {}),
        })}}
        InputProps={{
          inputRef: this.panelSearchInputRef,
          onBlur: () => this.setState({createRefFocused: false}),
          onFocus: () => this.setState({createRefFocused: true}),
          endAdornment: (
            <InputAdornment position="end">
              <AddIcon
                className={this.props.classes.addIcon}
                onClick={() => this.panelSearchInputRef.current?.focus()}
              />
            </InputAdornment>
          ),
        }}
      />
    );
    const createCollapsible = this.props.explorer.allowCreate && this.renderCreate(expand);

    return (
      <ExplorerTemplate
        createSize={expand ? '364px' : '116px'}
        createShown={expand}
        createVisible={createVisible}
        createCollapsible={createCollapsible}
        search={topBar}
        content={content}
      />
    );
  }

  renderCreate(expand:boolean) {
    if(!this.props.config
      || this.props.config.content.categories.length === 0) return null;

    var categoryOptions = (this.props.explorer.panel.search.filterCategoryIds && this.props.explorer.panel.search.filterCategoryIds.length > 0)
      ? this.props.config.content.categories.filter(c => this.props.explorer.panel.search.filterCategoryIds!.includes(c.categoryId))
      : this.props.config.content.categories;
    if(!ServerAdmin.get().isAdminLoggedIn()) categoryOptions = categoryOptions.filter(c => c.userCreatable);
    if(this.state.newItemChosenCategoryId === undefined && categoryOptions.length === 1) {
      this.setState({newItemChosenCategoryId: categoryOptions[0].categoryId})
    }
    const selectedCategory = categoryOptions.find(c => c.categoryId === this.state.newItemChosenCategoryId);
    const tagSelection = selectedCategory ? this.getTagSelection(selectedCategory) : undefined;
    const enableSubmit = this.state.newItemTitle && this.state.newItemChosenCategoryId && tagSelection && tagSelection.error === undefined;
    return (
      <div className={this.props.classes.createFormFields}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
        }}>
          <TextField
            id='createDescription'
            disabled={this.state.newItemIsSubmitting}
            className={this.props.classes.createFormField}
            placeholder='Description'
            value={this.state.newItemDescription || ''}
            onChange={e => {
              this.updateSearchText(this.state.newItemTitle, e.target.value);
              this.setState({newItemDescription: e.target.value})
            }}
            multiline
            rows={1}
            rowsMax={5}
          />
          {ServerAdmin.get().isAdminLoggedIn() && (
            <UserSelection
              server={this.props.server}
              className={this.props.classes.createFormField}
              disabled={this.state.newItemIsSubmitting}
              onChange={selectedUserLabel => this.setState({newItemAuthorLabel: selectedUserLabel})}
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
                  onChange={e => this.setState({newItemChosenCategoryId: e.target.value as string})}
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
            {tagSelection && tagSelection.options.length > 0 && (
              <div className={this.props.classes.createFormField}>
                <SelectionPicker
                  placeholder='Tags'
                  disabled={this.state.newItemIsSubmitting}
                  value={tagSelection.values}
                  options={tagSelection.options}
                  colorLookup={tagSelection.colorLookup}
                  helperText=' ' // Keep it aligned
                  errorMsg={tagSelection.error}
                  isMulti={true}
                  width='100%'
                  onValueChange={labels => this.setState({newItemChosenTagIds:
                    [...new Set(labels.map(label => label.value.substr(label.value.indexOf(':') + 1)))]})}
                  overrideComponents={{
                    MenuList: (menuProps) => {
                      const tagGroups:{[tagGroupId:string]:React.ReactNode[]} = {};
                      const children = Array.isArray(menuProps.children) ? menuProps.children : [menuProps.children];
                      children.forEach((child:any) => {
                        if(!child.props.data) {
                          // child is "No option(s)" text, ignore
                        } else {
                          const tagGroupId = child.props.data.value.substr(0, child.props.data.value.indexOf(':'));
                          if(!tagGroups[tagGroupId])tagGroups[tagGroupId] = [];
                          tagGroups[tagGroupId].push(child);
                        }
                      });
                      const menuItems = Object.keys(tagGroups).map(tagGroupId => (
                        <div className={this.props.classes.menuItem}>
                          <Typography variant='overline'>{selectedCategory!.tagging.tagGroups.find(g => g.tagGroupId === tagGroupId)!.name}</Typography>
                          {tagGroups[tagGroupId]}
                        </div>
                      ));
                      return (
                        <div {...menuProps} className={this.props.classes.menuContainer}>
                          <div style={{
                            MozColumns: `150px`,
                            WebkitColumns: `150px`,
                            columns: `150px`,
                          }}>
                            {menuItems}
                          </div>
                        </div>
                      );
                    },
                  }}
                />
              </div>
            )}
          </div>
          <Button
            color='primary'
            disabled={!enableSubmit || this.state.newItemIsSubmitting}
            onClick={e => enableSubmit && this.createClickSubmit(tagSelection && tagSelection.mandatoryTagIds || [])}
            style={{
              alignSelf: 'flex-end',
            }}
          >
            Submit
          </Button>
          <LogIn
            server={this.props.server}
            open={this.state.logInOpen}
            onClose={() => this.setState({logInOpen: false})}
            onLoggedInAndClose={() => {
              this.setState({logInOpen: false});
              this.createSubmit(tagSelection && tagSelection.mandatoryTagIds || [])
            }}
          />
        </div>
      </div>
    );
  }

  createClickSubmit(mandatoryTagIds:string[]) {
    if(!!this.state.newItemAuthorLabel || !!this.props.loggedInUserId) {
      this.createSubmit(mandatoryTagIds);
    } else {
      // open log in page, submit on success
      this.setState({logInOpen: true})
    }
  }

  createSubmit(mandatoryTagIds:string[]) {
    this.setState({newItemIsSubmitting: true});
    var createPromise:Promise<Client.Idea|Admin.Idea>;
    if(!!this.state.newItemAuthorLabel) {
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
      this.props.history.push(`${this.props.server.getProjectId()}/post/${idea.ideaId}`);
    }).catch(e => this.setState({
      newItemIsSubmitting: false,
    }));
  }

  getTagSelection(category:Client.Category):TagSelection {
    const tagSelection:TagSelection = {
      values: [],
      options: [],
      mandatoryTagIds: this.props.explorer.panel.search.filterTagIds || [],
      colorLookup: {},
    };
    const mandatoryTagIds = new Set(this.props.explorer.panel.search.filterTagIds || []);

    if(!this.props.config) return tagSelection;

    category.tagging.tagGroups
    .filter(tagGroup => tagGroup.userSettable)
    .forEach(tagGroup => {
      // Skip groups with tags that have mandatory tags
      if(tagGroup.tagIds.findIndex(t => mandatoryTagIds.has(t)) !== -1) return;

      var selectedCount = 0;
      category.tagging.tags
        .filter(t => tagGroup.tagIds.includes(t.tagId))
        .forEach(tag => {
          const label:Label = {
            label: tag.name,
            value: `${tagGroup.tagGroupId}:${tag.tagId}`,
          };
          if(tag.color) {
            tagSelection.colorLookup[label.value] = tag.color;
          }
          tagSelection.options.push(label);
          if(this.state.newItemChosenTagIds && this.state.newItemChosenTagIds.includes(tag.tagId)) {
            selectedCount++;
            tagSelection.values.push(label);
          }
        })
      if(tagGroup.minRequired !== undefined && selectedCount < tagGroup.minRequired) {
        if(tagGroup.minRequired === tagGroup.maxRequired) {
          if(tagGroup.minRequired === 1) {
            tagSelection.error = `Choose one ${tagGroup.name} tag`;
          } else {
            tagSelection.error = `Choose ${tagGroup.minRequired} ${tagGroup.name} tags`;
          }
        } else {
          tagSelection.error = `Choose at least ${tagGroup.maxRequired} ${tagGroup.name} tags`;
        }
      } else if(tagGroup.maxRequired !== undefined && selectedCount > tagGroup.maxRequired) {
        if(tagGroup.maxRequired === 1) {
          tagSelection.error = `Cannot choose more than one ${tagGroup.name} tag`;
        } else {
          tagSelection.error = `Cannot choose more than ${tagGroup.maxRequired} ${tagGroup.name} tags`;
        }
      }
    });

    return tagSelection;
  }
}

export default connect<ConnectProps,{},Props,ReduxState>((state, ownProps) => {
  if(!state.conf.conf && !state.conf.status) {
    ownProps.server.dispatch().configGetAndUserBind({projectId: ownProps.server.getProjectId()});
  }
  return {
    configver: state.conf.ver, // force rerender on config change
    config: state.conf.conf,
    loggedInUserId: state.users.loggedIn.user ? state.users.loggedIn.user.userId : undefined,
  }
}, null, null, { forwardRef: true })(withStyles(styles, { withTheme: true })(withRouter(Explorer)));
