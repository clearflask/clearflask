import { debounce, isWidthUp, withWidth, WithWidthProps } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import FilterIcon from '@material-ui/icons/TuneSharp';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import * as Client from '../../api/client';
import { ReduxState, Server, StateSettings } from '../../api/server';
import InViewObserver from '../../common/InViewObserver';
import { SearchTypeDebounceTime } from '../../common/util/debounce';
import minmax from '../../common/util/mathutil';
import { initialWidth } from '../../common/util/screenUtil';
import { animateWrapper } from '../../site/landing/animateUtil';
import SelectionPicker, { Label } from './SelectionPicker';

export enum FilterType {
  Search = 'search',
  Sort = 'sort',
  Category = 'category',
  Tag = 'tag',
  Status = 'status',
}

const styles = (theme: Theme) => createStyles({
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
  inputRoot: {
    '&::before': {
      borderBottomColor: 'transparent',
    },
  },
});

interface Props {
  style?: React.CSSProperties;
  className?: string;
  placeholder?: string;
  server: Server;
  search?: Partial<Client.IdeaSearch>;
  onSearchChanged: (search: Partial<Client.IdeaSearch>) => void;
  explorer: Client.PageExplorer;
}
interface ConnectProps {
  config?: Client.Config;
  settings: StateSettings;
}
interface State {
  searchValue?: string;
  menuIsOpen?: boolean;
}
class PanelSearch extends Component<Props & ConnectProps & WithStyles<typeof styles, true> & WithWidthProps, State> {
  state: State = {};
  _isMounted: boolean = false;
  readonly updateSearchText = debounce(
    (searchText?: string) => {
      if (!this.isFilterControllable(FilterType.Search)) return;
      this.props.onSearchChanged({
        ...this.props.search,
        searchText: searchText,
      });
    },
    SearchTypeDebounceTime);
  readonly inViewObserverRef = React.createRef<InViewObserver>();

  componentDidMount() {
    this._isMounted = true;
    if (!!this.props.settings.demoSearchAnimate) {
      this.demoSearchAnimate(this.props.settings.demoSearchAnimate);
    }
  }

  render() {
    const controls = this.getControls();
    const isSearchable = this.isFilterControllable(FilterType.Search);
    return (
      <InViewObserver ref={this.inViewObserverRef}>
        <div className={`${this.props.classes.container} ${this.props.className || ''}`} style={this.props.style}>
          <SelectionPicker
            value={controls.values}
            menuIsOpen={!!this.state.menuIsOpen}
            menuOnChange={open => this.setState({ menuIsOpen: open })}
            inputValue={this.state.searchValue || ''}
            onInputChange={(newValue, reason) => {
              this.setState({ searchValue: newValue });
              if (isSearchable) {
                this.updateSearchText(newValue);
              }
            }}
            placeholder={this.props.placeholder || 'Search'}
            options={controls.options}
            isMulti
            group
            isInExplorer
            width={100}
            autocompleteClasses={{
              inputRoot: this.props.classes.inputRoot,
            }}
            showTags={false}
            disableFilter
            disableCloseOnSelect
            disableClearOnValueChange
            onValueChange={labels => this.onValueChange(labels)}
            formatHeader={inputValue => !!inputValue ? `Searching for "${inputValue}"` : `Type to search`}
            dropdownIcon={FilterIcon}
            popupColumnCount={minmax(
              1,
              controls.groups,
              !this.props.width || isWidthUp('sm', this.props.width, true) ? 3 : 2)}
            PopperProps={{ placement: 'bottom-end' }}
          />
        </div>
      </InViewObserver>
    );
  }

  onValueChange(labels: Label[]) {
    const partialSearch: Partial<Client.IdeaSearch> = {};
    labels.forEach(label => {
      const type = this.getType(label);
      if (!this.isFilterControllable(type)) return;
      const data = this.getData(label);
      switch (type) {
        case FilterType.Search:
          partialSearch.searchText = data;
          break;
        case FilterType.Sort:
          partialSearch.sortBy = data as Client.IdeaSearchSortByEnum;
          break;
        case FilterType.Category:
          if (!partialSearch.filterCategoryIds) partialSearch.filterCategoryIds = [];
          partialSearch.filterCategoryIds.push(data);
          break;
        case FilterType.Status:
          if (!partialSearch.filterStatusIds) partialSearch.filterStatusIds = [];
          partialSearch.filterStatusIds.push(data);
          break;
        default:
          if (!partialSearch.filterTagIds) partialSearch.filterTagIds = [];
          partialSearch.filterTagIds.push(data);
          break;
      }
    });
    this.props.onSearchChanged(partialSearch);
  }

  getControls(): { values: Label[], options: Label[], permanent: Label[], groups: number } {
    const controls = {
      values: [] as Label[],
      options: [] as Label[],
      permanent: [] as Label[],
      groups: 0
    };

    if (!this.props.config) return controls;

    // sort
    if (!this.isFilterControllable(FilterType.Sort)) {
      const label: Label = this.getLabel(FilterType.Sort, this.props.explorer.search.sortBy!, this.props.explorer.search.sortBy!);
      controls.permanent.push(label);
    } else {
      controls.groups++;
      Object.keys(Client.IdeaSearchSortByEnum).forEach(sortBy => {
        const label: Label = this.getLabel(FilterType.Sort, sortBy, sortBy);
        controls.options.push(label);
        if (this.props.search && this.props.search.sortBy === sortBy) {
          controls.values.push(label);
        }
      });
    }

    var hasAny;

    // category
    var searchableCategories: Client.Category[] = [];
    if (!this.isFilterControllable(FilterType.Category)) {
      (this.props.explorer.search.filterCategoryIds || []).forEach(categoryId => {
        const category = this.props.config!.content.categories.find(c => c.categoryId === categoryId);
        if (!category) return;
        searchableCategories.push(category);
        const label: Label = this.getLabel(FilterType.Category, category.categoryId, category.name, category.color);
        controls.permanent.push(label);
      });
    } else {
      hasAny = false;
      if (!this.props.search || !this.props.search.filterCategoryIds || this.props.search.filterCategoryIds.length === 0) {
        searchableCategories = this.props.config.content.categories;
      }
      this.props.config.content.categories.forEach(category => {
        hasAny = true;
        const label: Label = this.getLabel(FilterType.Category, category.categoryId, category.name, category.color);
        controls.options.push(label);
        if (this.props.search && this.props.search.filterCategoryIds && this.props.search.filterCategoryIds.includes(category.categoryId)) {
          controls.values.push(label);
          searchableCategories.push(category);
        }
      });
      if (hasAny) controls.groups++;
    }

    // status
    if (!this.isFilterControllable(FilterType.Status)) {
      searchableCategories.forEach(category => {
        category.workflow.statuses.forEach(status => {
          if (this.props.explorer.search.filterStatusIds && this.props.explorer.search.filterStatusIds.includes(status.statusId)) {
            const label: Label = this.getLabel(FilterType.Status, status.statusId, status.name, status.color);
            controls.permanent.push(label);
          }
        })
      });
    } else {
      hasAny = false;
      searchableCategories.forEach(category => {
        category.workflow.statuses.forEach(status => {
          hasAny = true;
          const label: Label = this.getLabel(FilterType.Status, status.statusId, status.name, status.color);
          controls.options.push(label);
          if (this.props.search && this.props.search.filterStatusIds && this.props.search.filterStatusIds.includes(status.statusId)) {
            controls.values.push(label);
          }
        })
      });
      if (hasAny) controls.groups++;
    }

    // tag
    if (!this.isFilterControllable(FilterType.Tag)) {
      searchableCategories.forEach(category => {
        category.tagging.tags.forEach(tag => {
          if (this.props.explorer.search.filterTagIds && this.props.explorer.search.filterTagIds.includes(tag.tagId)) {
            const label: Label = this.getLabel(FilterType.Tag, tag.tagId, tag.name, tag.color);
            controls.permanent.push(label);
          }
        })
      });
    } else {
      hasAny = false;
      const filterTagIds = new Set(this.props.explorer.search.filterTagIds);
      searchableCategories.forEach(category => {
        category.tagging.tagGroups.forEach(tagGroup => {
          const matchingCount: number = tagGroup.tagIds.reduce((count, nextTagId) => count + (filterTagIds.has(nextTagId) ? 1 : 0), 0);
          const permanent = matchingCount > 0
            && (tagGroup.minRequired || 0) <= matchingCount
            && (tagGroup.maxRequired || tagGroup.tagIds.length) >= matchingCount;
          tagGroup.tagIds.forEach(tagId => {
            const tag = category.tagging.tags.find(t => t.tagId === tagId);
            if (!tag) return;
            const label: Label = this.getLabel(tagGroup.name, tag.tagId, tag.name, tag.color);
            if (permanent) {
              controls.permanent.push(label);
            } else {
              hasAny = true;
              controls.options.push(label);
              if (this.props.search && this.props.search.filterTagIds && this.props.search.filterTagIds.includes(tag.tagId)) {
                controls.values.push(label);
              }
            }
          })
        })
      });
      if (hasAny) controls.groups++;
    }

    // search is not added as a chip

    return controls;
  }

  getLabel(type: FilterType | string, data: string, name: string, color?: string): Label {
    return {
      label: name,
      filterString: name,
      value: `${type}:${data}`,
      groupBy: type,
      color: color,
    };
  }

  getType(label: Label): FilterType | string {
    return label.value.substr(0, label.value.indexOf(':'));
  }

  getData(label: Label): string {
    return label.value.substr(label.value.indexOf(':') + 1);
  }

  isFilterControllable(type: FilterType | string): boolean {
    switch (type) {
      case FilterType.Search:
        return this.props.explorer.allowSearch?.enableSearchText !== undefined ? this.props.explorer.allowSearch.enableSearchText : this.props.explorer.search.searchText === undefined;
      case FilterType.Sort:
        return this.props.explorer.allowSearch?.enableSort !== undefined ? this.props.explorer.allowSearch.enableSort : !this.props.explorer.search.sortBy;
      case FilterType.Category:
        return this.props.explorer.allowSearch?.enableSearchByCategory !== undefined ? this.props.explorer.allowSearch.enableSearchByCategory : (!this.props.explorer.search.filterCategoryIds || this.props.explorer.search.filterCategoryIds.length <= 0);
      case FilterType.Tag:
        return this.props.explorer.allowSearch?.enableSearchByTag !== undefined ? this.props.explorer.allowSearch.enableSearchByTag : true;
      case FilterType.Status:
        return this.props.explorer.allowSearch?.enableSearchByStatus !== undefined ? this.props.explorer.allowSearch.enableSearchByStatus : (!this.props.explorer.search.filterStatusIds || this.props.explorer.search.filterStatusIds.length <= 0);
      default:
        return true;
    }
  }

  async demoSearchAnimate(searchTerms: Array<{
    term: string;
    update: Partial<Client.IdeaSearch>;
  }>) {
    const animate = animateWrapper(
      () => this._isMounted,
      this.inViewObserverRef,
      () => this.props.settings,
      this.setState.bind(this));

    if (await animate({ sleepInMs: 1000 })) return;

    for (; ;) {
      for (const searchTerm of searchTerms) {
        if (await animate({ sleepInMs: 150, setState: { menuIsOpen: true } })) return;

        if (await animate({ sleepInMs: 2000 })) return;
        for (var i = 0; i < searchTerm.term.length; i++) {
          const term = searchTerm.term[i];
          if (await animate({
            sleepInMs: 10 + Math.random() * 30,
            setState: { searchValue: (this.state.searchValue || '') + term, menuIsOpen: true }
          })) return;
        }

        if (await animate({ sleepInMs: 2000, setState: { searchValue: '', menuIsOpen: undefined } })) return;
        this.props.onSearchChanged({ ...this.props.search, ...searchTerm.update });
      }

      if (await animate({ sleepInMs: 300 })) return;
      this.props.onSearchChanged({});
    }
  }
}

export default connect<ConnectProps, {}, Props, ReduxState>((state: ReduxState, ownProps: Props) => {
  return {
    configver: state.conf.ver, // force rerender on config change
    config: state.conf.conf,
    settings: state.settings,
  }
}, null, null, { forwardRef: true })(withWidth({ initialWidth })(withStyles(styles, { withTheme: true })(PanelSearch)));
