import React, { Component } from 'react';
import { Server, ReduxState } from '../../api/server';
import { withStyles, Theme, createStyles, WithStyles } from '@material-ui/core/styles';
import * as Client from '../../api/client';
import { connect } from 'react-redux';
import SelectionPicker, { Label, ColorLookup } from './SelectionPicker';
import { Typography, MenuItem } from '@material-ui/core';
import { ActionMeta } from 'react-select/lib/types';
import FilterIcon from '@material-ui/icons/FilterListRounded';

export enum FilterType {
  Search = 'search',
  Sort = 'sort',
  Category = 'category',
  Tag = 'tag',
  Status = 'status',
}
const FilterTypes = new Set(Object.values(FilterType));

const styles = (theme:Theme) => createStyles({
  container: {
    margin: theme.spacing(1),
  },
  menuContainer: {
    margin: theme.spacing(2),
  },
  menuList: {
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
  style?:React.CSSProperties;
  className?:string;
  server:Server;
  search?:Partial<Client.IdeaSearch>;
  onSearchChanged:(search:Partial<Client.IdeaSearch>)=>void;
  panel:Client.PagePanelWithSearch;
}

interface ConnectProps {
  config?:Client.Config;
}

class PanelSearch extends Component<Props&ConnectProps&WithStyles<typeof styles, true>> {

  onClickTag(tagId:string):void {
    this.props.onSearchChanged({...this.props.search, filterTagIds: [tagId]});
  }
  onClickCategory(categoryId:string):void {
    this.props.onSearchChanged({...this.props.search, filterCategoryIds: [categoryId]});
  }
  onClickStatus(statusId:string):void {
    this.props.onSearchChanged({...this.props.search, filterStatusIds: [statusId]});
  }

  render() {
    const controls = this.getControls();
    return (
      <div className={`${this.props.classes.container} ${this.props.className || ''}`} style={this.props.style}>
        <SelectionPicker
          label='Search'
          value={controls.values}
          options={controls.options}
          colorLookup={controls.colorLookup}
          isMulti={true}
          inputMinWidth='100px'
          onValueChange={this.onValueChange.bind(this)}
          onValueCreate={this.isFilterControllable(FilterType.Search) ? this.onValueCreate.bind(this) : undefined}
          formatCreateLabel={inputValue => `Search '${inputValue}'`}
          overrideComponents={{
            DropdownIndicator: (dropdownIndicatorProps) => (
              <FilterIcon fontSize='inherit' className={dropdownIndicatorProps.selectProps.commonProps.classes.dropdownIcon} />
            ),
            MenuList: (menuProps) => {
              var newSearch:React.ReactNode|undefined;
              const tagColumns:any = {};
              const baseColumns:any = {};
              const children = Array.isArray(menuProps.children) ? menuProps.children : [menuProps.children];
              children.forEach((child:any) => {
                if(!child.props.data) {
                  // child is "No option(s)" text, ignore
                } else if(child.props.data.__isNew__) {
                  newSearch = child; // child is "Search '...'" option
                } else {
                  const type = this.getType(child.props.data);
                  const columns = FilterTypes.has(type as any) ? baseColumns : tagColumns;
                  if(!columns[type]) columns[type] = [];
                  columns[type].push(child);
                }
              });
              const menuItems:React.ReactNode[] = [];
              const addColumn = (title, content) => menuItems.push((
                <div className={this.props.classes.menuItem}>
                  <Typography variant='overline'>{title}</Typography>
                  {content ? content : (
                    <MenuItem component="div" disabled>
                      No option
                    </MenuItem>
                  )}
                </div>
              ));
              Object.values(FilterType)
              .filter(t => this.isFilterControllable(t)
                && t !== FilterType.Search
                && t !== FilterType.Tag
                && baseColumns[t])
              .forEach(t => addColumn(t, baseColumns[t]));
              Object.keys(tagColumns)
                .forEach(t => addColumn(t, tagColumns[t]));
              return (
                <div {...menuProps} className={this.props.classes.menuContainer}>
                  {newSearch ? newSearch : (
                    <MenuItem component="div" disabled>
                      Type to search
                    </MenuItem>
                  )}
                  <div style={{
                    columnWidth: '150px',
                  }}>
                    {menuItems}
                  </div>
                </div>
              );
            },
          }}
        />
      </div>
    );
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
        case FilterType.Status:
          if(!partialSearch.filterStatusIds) partialSearch.filterStatusIds = [];
          partialSearch.filterStatusIds.push(data);
          break;
        default:
          if(!partialSearch.filterTagIds) partialSearch.filterTagIds = [];
          partialSearch.filterTagIds.push(data);
          break;
        }
    });
    this.props.onSearchChanged(partialSearch);
  }

  onValueCreate(searchText:string) {
    if(!this.isFilterControllable(FilterType.Search)) return;
    this.props.onSearchChanged({
      ...this.props.search,
      searchText: searchText
    });
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
        if(this.props.search && this.props.search.sortBy === sortBy) {
          controls.values.push(label);
        }
      });
    }

    // category
    var searchableCategories:Client.Category[] = [];
    if(!this.isFilterControllable(FilterType.Category)) {
      (this.props.panel.search.filterCategoryIds || []).forEach(categoryId => {
        const category = this.props.config!.content.categories.find(c => c.categoryId === categoryId);
        if(!category) return;
        searchableCategories.push(category);
        const label:Label = this.getLabel(FilterType.Category, category.categoryId, category.name);
        controls.permanent.push(label);
        controls.colorLookup[label.value] = category.color;
      });
    } else {
      if(!this.props.search || !this.props.search.filterCategoryIds || this.props.search.filterCategoryIds.length === 0) {
        searchableCategories = this.props.config.content.categories;
      }
      this.props.config.content.categories.forEach(category => {
        const label:Label = this.getLabel(FilterType.Category, category.categoryId, category.name);
        controls.options.push(label);
        controls.colorLookup[label.value] = category.color;
        if(this.props.search && this.props.search.filterCategoryIds && this.props.search.filterCategoryIds.includes(category.categoryId)) {
          controls.values.push(label);
          searchableCategories.push(category);
        }
      });
    }

    // status
    if(!this.isFilterControllable(FilterType.Status)) {
      searchableCategories.forEach(category => {
        category.workflow.statuses.forEach(status => {
          if(this.props.panel.search.filterStatusIds && this.props.panel.search.filterStatusIds.includes(status.statusId)) {
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
          if(this.props.search && this.props.search.filterStatusIds && this.props.search.filterStatusIds.includes(status.statusId)) {
            controls.values.push(label);
          }
        })
      });
    }

    // tag
    if(!this.isFilterControllable(FilterType.Tag)) {
      searchableCategories.forEach(category => {
        category.tagging.tags.forEach(tag => {
          if(this.props.panel.search.filterTagIds && this.props.panel.search.filterTagIds.includes(tag.tagId)) {
            const label:Label = this.getLabel(FilterType.Tag, tag.tagId, tag.name);
            controls.permanent.push(label);
            controls.colorLookup[label.value] = tag.color;
          }
        })
      });
    } else {
      const filterTagIds = new Set(this.props.panel.search.filterTagIds);
      searchableCategories.forEach(category => {
        category.tagging.tagGroups.forEach(tagGroup => {
          const matchingCount:number = tagGroup.tagIds.reduce((count, nextTagId) => count + (filterTagIds.has(nextTagId) ? 1 : 0), 0);
          const permanent = matchingCount > 0
            && (tagGroup.minRequired || 0) <= matchingCount
            && (tagGroup.maxRequired || tagGroup.tagIds.length) >= matchingCount;
          tagGroup.tagIds.forEach(tagId => {
            const tag = category.tagging.tags.find(t => t.tagId === tagId);
            if(!tag) return;
            const label:Label = this.getLabel(tagGroup.name, tag.tagId, tag.name);
            if(permanent) {
              controls.permanent.push(label);
            } else {
              controls.options.push(label);
              controls.colorLookup[label.value] = tag.color;
              if(this.props.search && this.props.search.filterTagIds && this.props.search.filterTagIds.includes(tag.tagId)) {
                controls.values.push(label);
              }
            }
          })
        })
      });
    }

    // search
    if(!this.isFilterControllable(FilterType.Search)) {
      const label:Label = this.getLabel(FilterType.Search, this.props.panel.search.searchText!, this.props.panel.search.searchText!);
      controls.permanent.push(label);
    } else if(this.props.search && this.props.search.searchText != undefined) {
      const label:Label = this.getLabel(FilterType.Search, this.props.search.searchText, this.props.search.searchText);
      controls.options.push(label);
      controls.values.push(label);
    }

    return controls;
  }

  getLabel(type:FilterType|string, data:string, name:string):Label {
    return {
      label: name,
      value: `${type}:${data}`,
    };
  }
  
  getType(label:Label):FilterType|string {
    return label.value.substr(0, label.value.indexOf(':'));
  }

  getData(label:Label):string {
    return label.value.substr(label.value.indexOf(':') + 1);
  }

  isFilterControllable(type:FilterType|string):boolean {
    switch(type) {
      case FilterType.Search:
        return this.props.panel.enableSearchText !== undefined ? this.props.panel.enableSearchText : this.props.panel.search.searchText === undefined;
      case FilterType.Sort:
        return this.props.panel.enableSort !== undefined ? this.props.panel.enableSort : !this.props.panel.search.sortBy;
      case FilterType.Category:
        return this.props.panel.enableSearchByCategory !== undefined ? this.props.panel.enableSearchByCategory : (!this.props.panel.search.filterCategoryIds || this.props.panel.search.filterCategoryIds.length <= 0);
      case FilterType.Tag:
        return this.props.panel.enableSearchByTag !== undefined ? this.props.panel.enableSearchByTag : true;
      case FilterType.Status:
        return this.props.panel.enableSearchByStatus !== undefined ? this.props.panel.enableSearchByStatus : (!this.props.panel.search.filterStatusIds || this.props.panel.search.filterStatusIds.length <= 0);
      default:
        return true;
    }
  }
}

export default connect<ConnectProps,{},Props,ReduxState>((state:ReduxState, ownProps:Props) => {return {
  configver: state.conf.ver, // force rerender on config change
  config: state.conf.conf,
}}, null, null, { forwardRef: true })(withStyles(styles, { withTheme: true })(PanelSearch));
