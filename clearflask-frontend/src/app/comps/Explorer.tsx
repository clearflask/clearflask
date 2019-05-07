import React, { Component } from 'react';
import { Server, getSearchKey, ReduxState, Status } from '../../api/server';
import { withStyles, Theme, createStyles, WithStyles } from '@material-ui/core/styles';
import * as Client from '../../api/client';
import Panel, { Direction } from './Panel';
import { Typography, TextField, Divider, Grow, Button, Select, MenuItem, FormControl, FormHelperText } from '@material-ui/core';
import DividerCorner from '../utils/DividerCorner';
import { connect } from 'react-redux';
import PanelSearch from './PanelSearch';
import SelectionPicker, { ColorLookup, Label } from './SelectionPicker';
import LogInDialog from './LogInDialog';

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
  explorer: {
    margin: theme.spacing.unit,
    display: 'grid',
    gridTemplateColumns: 'auto minmax(0, 1fr)',
    /// 111px leaves enough space for search bar to have two lines without cell expanding
    gridTemplateRows: 'minmax(111px, auto) minmax(0, 1fr)',
    gridTemplateAreas:
      '". search"'
      + '"create results"',
  },
  search: {
    gridArea: 'search',
    alignSelf: 'end',
    margin: theme.spacing.unit * 2,
  },
  results: {
    gridArea: 'results',
  },
  resultsInner: {
    margin: theme.spacing.unit * 2,
  },
  create: {
    gridArea: 'create',
    margin: theme.spacing.unit,
  },
  createFormFields: {
    display: 'flex',
    flexDirection: 'column',
    margin: theme.spacing.unit,
    transition: theme.transitions.create('width'),
  },
  createFormField: {
    margin: theme.spacing.unit,
    width: 'auto',
    flexGrow: 1,
  },
  caption: {
    margin: theme.spacing.unit,
    color: theme.palette.text.hint,
  },
  menuContainer: {
    margin: theme.spacing.unit * 2,
  },
  menuItem: {
    display: 'inline-block',
    width: '100%',
    webkitColumnBreakInside: 'avoid',
    pageBreakInside: 'avoid',
    breakInside: 'avoid',
  },
});

interface Props {
  server:Server;
  explorer:Client.PageExplorer;
}

interface ConnectProps {
  configver?:string;
  config?:Client.Config;
  isLoggedIn:boolean;
  createPost: (title:string, description:string|undefined, categoryId:string, tagIds:string[]) => void;
}

interface State {
  newItemTitle?:string;
  newItemDescription?:string;
  newItemChosenCategoryId?:string;
  newItemChosenTagIds?:string[];
  search?:Partial<Client.IdeaSearch>;
  logInOpen?:boolean;
}

class Explorer extends Component<Props&ConnectProps&WithStyles<typeof styles, true>, State> {
  readonly panelSearchRef:React.RefObject<any> = React.createRef();

  constructor(props) {
    super(props);
    this.state = {};
  }

  render() {
    const createFormHasTypedIn = !!(this.state.newItemTitle || this.state.newItemDescription);
    var content, topBar;
    if(createFormHasTypedIn) {
      topBar = (
        <Typography variant='overline' className={this.props.classes.caption}>Similar:</Typography>
        );
      content = (
        <div>
          <Panel
            key={getSearchKey(this.props.explorer.panel.search)}
            direction={Direction.Vertical}
            panel={this.props.explorer.panel}
            searchOverride={{searchText: `${this.state.newItemTitle || ''} ${this.state.newItemDescription || ''}`}}
            server={this.props.server}
            displayDefaults={{
              titleTruncateLines: 1,
              descriptionTruncateLines: 2,
              showDescription: true,
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
      topBar = this.props.explorer.allowCreate && (
        <PanelSearch
          innerRef={this.panelSearchRef}
          server={this.props.server}
          search={this.state.search}
          onSearchChanged={search => this.setState({ search: search })}
          panel={this.props.explorer.panel}
        />
      );
      content = (
        <div>
          <Panel
            key={getSearchKey(this.props.explorer.panel.search)}
            server={this.props.server}
            direction={Direction.Vertical}
            panel={this.props.explorer.panel}
            displayDefaults={{
              titleTruncateLines: 1,
              descriptionTruncateLines: 2,
              showDescription: true,
              showCommentCount: true,
              showCreated: true,
              showAuthor: true,
              showVoting: true,
              showFunding: true,
              showExpression: true,
            }} 
            searchOverride={this.state.search}
            {...(this.props.explorer.allowCreate ? {
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

    const create = this.props.explorer.allowCreate && this.renderCreate();

    return (
      <div className={this.props.classes.explorer}>
        <div className={this.props.classes.search}>
          {topBar}
        </div>
        <div className={this.props.classes.create}>
          {create}
        </div>
        <div className={this.props.classes.results}>
          <DividerCorner width='160px' height={this.props.explorer.allowCreate ? '320px' : '80px'}>
            <div className={this.props.classes.resultsInner}>
              {content}
            </div>
          </DividerCorner>
        </div>
      </div>
    );
  }

  renderCreate() {
    if(!this.props.config
      || this.props.config.content.categories.length === 0) return null;

    const createFormHasTypedIn = !!(this.state.newItemTitle || this.state.newItemDescription);
    const categoryOptions = ((this.props.explorer.panel.search.filterCategoryIds && this.props.explorer.panel.search.filterCategoryIds.length > 0)
      ? this.props.config.content.categories.filter(c => this.props.explorer.panel.search.filterCategoryIds!.includes(c.categoryId))
      : this.props.config.content.categories)
      .filter(c => c.userCreatable);
    if(this.state.newItemChosenCategoryId === undefined && categoryOptions.length === 1) {
      this.setState({newItemChosenCategoryId: categoryOptions[0].categoryId})
    }
    const selectedCategory = categoryOptions.find(c => c.categoryId === this.state.newItemChosenCategoryId);
    const tagSelection = selectedCategory ? this.getTagSelection(selectedCategory) : undefined;
    const enableSubmit = this.state.newItemTitle && this.state.newItemChosenCategoryId && tagSelection && tagSelection.error === undefined;
    return (
      <div className={this.props.classes.createFormFields} style={{
        width: (createFormHasTypedIn)
          ? '384px': '100px',
      }}>
        <Typography variant='overline' className={this.props.classes.caption}>Create</Typography>
        <TextField
          id='createTitle'
          className={this.props.classes.createFormField}
          placeholder='Title'
          value={this.state.newItemTitle}
          onChange={e => this.setState({
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
          })}
        />
        <Grow in={createFormHasTypedIn} unmountOnExit>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
          }}>
            <TextField
              id='createDescription'
              className={this.props.classes.createFormField}
              placeholder='Description'
              value={this.state.newItemDescription}
              onChange={e => this.setState({newItemDescription: e.target.value})}
              multiline
            />
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
                    value={selectedCategory ? selectedCategory.categoryId : undefined}
                    onChange={e => this.setState({newItemChosenCategoryId: e.target.value})}
                  >
                    {categoryOptions.map(categoryOption => (
                      <MenuItem value={categoryOption.categoryId}>{categoryOption.name}</MenuItem>
                    ))}
                  </Select>
                  <FormHelperText>
                    {!selectedCategory && 'Choose a category'}
                  </FormHelperText>
                </FormControl>
              )}
              {tagSelection && tagSelection.options.length > 0 && (
                <div className={this.props.classes.createFormField}>
                  <SelectionPicker
                    placeholder='Tags'
                    value={tagSelection.values}
                    options={tagSelection.options}
                    colorLookup={tagSelection.colorLookup}
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
                              mozColumns: `150px`,
                              webkitColumns: `150px`,
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
              disabled={!enableSubmit}
              onClick={e => enableSubmit && this.createClickSubmit(tagSelection && tagSelection.mandatoryTagIds || [])}
              style={{
                alignSelf: 'flex-end',
              }}
            >
              Submit
            </Button>
            <LogInDialog
              server={this.props.server}
              open={this.state.logInOpen}
              onClose={() => this.setState({logInOpen: false})}
              onLoggedIn={() => this.createSubmit(tagSelection && tagSelection.mandatoryTagIds || [])}
            />
          </div>
        </Grow>
      </div>
    );
  }

  createClickSubmit(mandatoryTagIds:string[]) {
    if(this.props.isLoggedIn) {
      this.createSubmit(mandatoryTagIds);
    } else {
      // open log in page, submit on success
      this.setState({logInOpen: true})
    }
  }

  createSubmit(mandatoryTagIds:string[]) {
    this.props.createPost(
      this.state.newItemTitle!,
      this.state.newItemDescription,
      this.state.newItemChosenCategoryId!,
      [...mandatoryTagIds, ...(this.state.newItemChosenTagIds || [])],
    );
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

export default connect<ConnectProps,{},Props,ReduxState>((state, ownProps) => {return {
  configver: state.conf.ver, // force rerender on config change
  config: state.conf.conf,
  isLoggedIn: state.users.loggedIn.status === Status.FULFILLED,
  createPost: (title:string, description:string|undefined, categoryId:string, tagIds:string[]):void => {state.users.loggedIn.user && ownProps.server.dispatch().ideaCreate({
    projectId: state.projectId,
    create: {
      authorUserId: state.users.loggedIn.user.userId,
      title: title,
      description: description,
      categoryId: categoryId,
      tagIds: tagIds,
    },
  })},
}}, null, null, { forwardRef: true })(withStyles(styles, { withTheme: true })(Explorer));
