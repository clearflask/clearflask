import React, { Component } from 'react';
import { Server, ReduxState } from '../../api/server';
import { withStyles, Theme, createStyles, WithStyles } from '@material-ui/core/styles';
import * as Client from '../../api/client';
import { connect } from 'react-redux';
import Panel, { Direction } from './Panel';
import SelectionPicker, { Label, ColorLookup } from './SelectionPicker';
import { Typography, MenuItem } from '@material-ui/core';
import { ActionMeta } from 'react-select/lib/types';

enum FilterType {
  Search = 'search',
  Sort = 'sort',
  Category = 'category',
  Tag = 'tag',
  Status = 'status',
}

const styles = (theme:Theme) => createStyles({
  selection: {
    margin: theme.spacing.unit,
  },
  menuContainer: {
    margin: theme.spacing.unit,
  },
  menuList: {
  },
  menuItem: {
    margin: theme.spacing.unit,
    webkitColumnBreakInside: 'avoid',
    pageBreakInside: 'avoid',
    breakInside: 'avoid',
  },
});

interface Props extends WithStyles<typeof styles> {
  server:Server;
  panel:Client.PagePanel;
  displayDefaults?:Client.PostDisplay;
  direction:Direction
  // connect
  config?:Client.Config;
}

interface State {
  overrideSearch?:Partial<Client.IdeaSearch>;
}

class PanelWithControls extends Component<Props, State> {

  constructor(props:Props) {
    super(props);
    this.state = {};
  }

  render() {
    const controls = this.getControls();
    return [
      <div className={this.props.classes.selection}>
        <SelectionPicker
          value={controls.values}
          options={controls.options}
          colorLookup={controls.colorLookup}
          isMulti={true}
          inputMinWidth='130px'
          onValueChange={this.onValueChange.bind(this)}
          onValueCreate={this.isFilterControllable(FilterType.Search) ? this.onValueCreate.bind(this) : undefined}
          placeholder='Search'
          formatCreateLabel={inputValue => `Search '${inputValue}'`}
          bare
          overrideComponents={{
            MenuList: (menuProps) => {
              var newSearch:React.ReactNode|undefined;
              const filters:any = {};
              const children = Array.isArray(menuProps.children) ? menuProps.children : [menuProps.children];
              children.forEach((child:any) => {
                if(!child.props.data) {
                  // child is "No option(s)" text, ignore
                } else if(child.props.data.__isNew__) {
                  newSearch = child; // child is "Search '...'" option
                } else {
                  const type:FilterType = this.getType(child.props.data);
                  if(!filters[type])filters[type] = [];
                  filters[type].push(child);
                }
              });
              const menuItems = Object.values(FilterType).map(type => type !== FilterType.Search
                && this.isFilterControllable(type)
                && (!newSearch || filters[type])
                && (
                  <div className={this.props.classes.menuItem}>
                    <Typography variant='overline'>{type}</Typography>
                    {filters[type] ? filters[type] : (
                      <MenuItem component="div" disabled>
                        No option
                      </MenuItem>
                    )}
                  </div>
                ));
              const menuItemColumnCount = Math.min(3, menuItems.filter(m => !!m).length);
              return (
                <div {...menuProps} className={this.props.classes.menuContainer}>
                  {newSearch ? newSearch : (
                    <MenuItem component="div" disabled>
                      Type to search
                    </MenuItem>
                  )}
                  <div style={{
                    mozColumns: `${menuItemColumnCount} 150px`,
                    webkitColumns: `${menuItemColumnCount} 150px`,
                    columns: `${menuItemColumnCount} 150px`,
                  }}>
                    {menuItems}
                  </div>
                </div>
              );
            },
          }}
        />
      </div>,
      <Panel
        server={this.props.server}
        panel={this.props.panel}
        displayDefaults={this.props.displayDefaults}
        searchOverride={this.state.overrideSearch}
        direction={this.props.direction}
        onClickTag={tagId => this.setState({overrideSearch: {...this.state.overrideSearch, filterTagIds: [tagId]}}) }
        onClickCategory={categoryId => this.setState({overrideSearch: {...this.state.overrideSearch, filterCategoryIds: [categoryId]}}) }
        onClickStatus={statusId => this.setState({overrideSearch: {...this.state.overrideSearch, filterStatusIds: [statusId]}}) }
      />,
    ];
  }

  onValueChange(labels:Label[], action: ActionMeta) {
    const partialSearch:Partial<Client.IdeaSearch> = {};
    labels.forEach(label => {
      const type = this.getType(label);
      if(!this.isFilterControllable(type)) return;
      const data = this.getData(label);
      switch(type) {
        case FilterType.Search:
          partialSearch.searchText = data;
          break;
        case FilterType.Sort:
          partialSearch.sortBy = data as Client.IdeaSearchSortByEnum;
          break;
        case FilterType.Category:
          if(!partialSearch.filterCategoryIds) partialSearch.filterCategoryIds = [];
          partialSearch.filterCategoryIds.push(data);
          break;
        case FilterType.Tag:
          if(!partialSearch.filterTagIds) partialSearch.filterTagIds = [];
          partialSearch.filterTagIds.push(data);
          break;
        case FilterType.Status:
          if(!partialSearch.filterStatusIds) partialSearch.filterStatusIds = [];
          partialSearch.filterStatusIds.push(data);
          break;
        default:
          throw Error(`Unknown filter ${this.getType(type)}`);
        }
    });
    this.setState({overrideSearch: partialSearch});
  }

  onValueCreate(searchText:string) {
    if(!this.isFilterControllable(FilterType.Search)) return;
    this.setState({overrideSearch: {
      ...this.state.overrideSearch,
      searchText: searchText
    }});
  }

  getControls():{values: Label[], options: Label[], permanent: Label[], colorLookup:ColorLookup} {
    const controls = {
      values: [] as Label[],
      options: [] as Label[],
      permanent: [] as Label[],
      colorLookup: {},
    };

    if(!this.props.config) return controls;

    // sort
    if(!this.isFilterControllable(FilterType.Sort)) {
      const label:Label = this.getLabel(FilterType.Sort, this.props.panel.search.sortBy!, this.props.panel.search.sortBy!);
      controls.permanent.push(label);
    } else {
      Object.keys(Client.IdeaSearchSortByEnum).forEach(sortBy => {
        const label:Label = this.getLabel(FilterType.Sort, sortBy, sortBy);
        controls.options.push(label);
        if(this.state.overrideSearch && this.state.overrideSearch.sortBy === sortBy) {
          controls.values.push(label);
        }
      });
    }

    // category
    var searchableCategories:Client.Category[] = [];
    if(!this.isFilterControllable(FilterType.Category)) {
      this.props.panel.search.filterCategoryIds!.forEach(categoryId => {
        const category = this.props.config!.content.categories.find(c => c.categoryId === categoryId);
        if(!category) return;
        searchableCategories.push(category);
        const label:Label = this.getLabel(FilterType.Category, category.categoryId, category.name);
        controls.permanent.push(label);
        controls.colorLookup[label.value] = category.color;
      });
    } else {
      if(!this.state.overrideSearch || !this.state.overrideSearch.filterCategoryIds || this.state.overrideSearch.filterCategoryIds.length === 0) {
        searchableCategories = this.props.config.content.categories;
      }
      this.props.config.content.categories.forEach(category => {
        const label:Label = this.getLabel(FilterType.Category, category.categoryId, category.name);
        controls.options.push(label);
        controls.colorLookup[label.value] = category.color;
        if(this.state.overrideSearch && this.state.overrideSearch.filterCategoryIds && this.state.overrideSearch.filterCategoryIds.includes(category.categoryId)) {
          controls.values.push(label);
          searchableCategories.push(category);
        }
      });
    }

    // status
    if(!this.isFilterControllable(FilterType.Status)) {
      searchableCategories.forEach(category => {
        category.workflow.statuses.forEach(status => {
          if(this.props.panel.search.filterStatusIds!.includes(status.statusId)) {
            const label:Label = this.getLabel(FilterType.Status, status.statusId, status.name);
            controls.permanent.push(label);
            controls.colorLookup[label.value] = status.color;
          }
        })
      });
    } else {
      searchableCategories.forEach(category => {
        category.workflow.statuses.forEach(status => {
          const label:Label = this.getLabel(FilterType.Status, status.statusId, status.name);
          controls.options.push(label);
          controls.colorLookup[label.value] = status.color;
          if(this.state.overrideSearch && this.state.overrideSearch.filterStatusIds && this.state.overrideSearch.filterStatusIds.includes(status.statusId)) {
            controls.values.push(label);
          }
        })
      });
    }

    // tag
    if(!this.isFilterControllable(FilterType.Tag)) {
      searchableCategories.forEach(category => {
        category.tagging.tags.forEach(tag => {
          if(this.props.panel.search.filterTagIds!.includes(tag.tagId)) {
            const label:Label = this.getLabel(FilterType.Tag, tag.tagId, tag.name);
            controls.permanent.push(label);
            controls.colorLookup[label.value] = tag.color;
          }
        })
      });
    } else {
      searchableCategories.forEach(category => {
        category.tagging.tags.forEach(tag => {
          const label:Label = this.getLabel(FilterType.Tag, tag.tagId, tag.name);
          controls.options.push(label);
          controls.colorLookup[label.value] = tag.color;
          if(this.state.overrideSearch && this.state.overrideSearch.filterTagIds && this.state.overrideSearch.filterTagIds.includes(tag.tagId)) {
            controls.values.push(label);
          }
        })
      });
    }

    // search
    if(!this.isFilterControllable(FilterType.Search)) {
      const label:Label = this.getLabel(FilterType.Search, this.props.panel.search.searchText!, this.props.panel.search.searchText!);
      controls.permanent.push(label);
    } else if(this.state.overrideSearch && this.state.overrideSearch.searchText != undefined) {
      const label:Label = this.getLabel(FilterType.Search, this.state.overrideSearch.searchText, this.state.overrideSearch.searchText);
      controls.options.push(label);
      controls.values.push(label);
    }

    return controls;
  }

  getLabel(type:FilterType, data:string, name:string):Label {
    return {
      label: `${name}`,
      value: `${type}:${data}`,
    };
  }
  
  getType(label:Label):FilterType {
    return label.value.substr(0, label.value.indexOf(':')) as FilterType;
  }

  getData(label:Label):string {
    return label.value.substr(label.value.indexOf(':') + 1);
  }

  isFilterControllable(type:FilterType):boolean {
    switch(type) {
      case FilterType.Search:
        return this.props.panel.search.searchText === undefined;
      case FilterType.Sort:
        return !this.props.panel.search.sortBy;
      case FilterType.Category:
        return !this.props.panel.search.filterCategoryIds || this.props.panel.search.filterCategoryIds.length <= 0;
      case FilterType.Tag:
        return !this.props.panel.search.filterTagIds || this.props.panel.search.filterTagIds.length <= 0;
      case FilterType.Status:
        return !this.props.panel.search.filterStatusIds || this.props.panel.search.filterStatusIds.length <= 0;
      default:
        throw Error(`Unknown filter ${type}`);
    }
  }
}

export default connect<any,any,any,any>((state:ReduxState, ownProps:Props) => {return {
  configver: state.conf.ver, // force rerender on config change
  config: state.conf.conf,
}})(withStyles(styles, { withTheme: true })(PanelWithControls));
