// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only

import * as Admin from '../../api/admin';
import * as Client from '../../api/client';
import { Label } from '../../app/comps/SelectionPicker';

/***
 ** COMMON
 */

export enum PostFilterType {
  Search = 'Search',
  Sort = 'Sort',
  Category = 'Category',
  Tag = 'Tag',
  Status = 'Status',
}
export type LabelGroup = {
  groupName: string;
  controlType: 'search' | 'radio' | 'check';
  labels: Array<Label>;
  filterType: PostFilterType;
};
export type LabelGroups = Array<LabelGroup>;
export const groupLabels = (labels: Label[], forceSingleCategory?: boolean): LabelGroups => {
  const results: LabelGroups = [];
  const groupLookup: { [groupName: string]: LabelGroups[0] } = {};
  labels.forEach(label => {
    const groupName = label.groupBy || '';
    var group = groupLookup[groupName];
    if (!group) {
      const type: PostFilterType = label.value.split(':')[0] as PostFilterType;
      var controlType: LabelGroup['controlType'] = 'check';
      if (type === PostFilterType.Search) {
        controlType = 'search';
      } else if (type === PostFilterType.Sort
        || (!!forceSingleCategory && type === PostFilterType.Category)) {
        controlType = 'radio';
      }

      group = {
        groupName,
        controlType,
        labels: [label],
        filterType: type,
      };
      groupLookup[groupName] = group;
      results.push(group);
    } else {
      group.labels.push(label);
    }
  })
  return results.filter(group => group.labels.length > 1);
}

/***
 ** POST
 */

export interface PostLabels {
  values: Label[];
  options: Label[];
  permanent: Label[];
  groups: number;
}
export const postSearchToLabels = (
  config?: Client.Config,
  explorer?: Client.PageExplorer,
  searchModified?: Partial<Client.IdeaSearch>,
  forceSingleCategory?: boolean,
): PostLabels => {
  const controls: PostLabels = {
    values: [],
    options: [],
    permanent: [],
    groups: 0
  };

  if (!config || !explorer) return controls;

  // category
  var searchableCategories: Client.Category[] = [];
  if (!isFilterControllable(explorer, PostFilterType.Category)) {
    (explorer.search.filterCategoryIds?.map(categoryId => config!.content.categories.find(c => c.categoryId === categoryId)!) || config!.content.categories).forEach(category => {
      if (!category) return;
      searchableCategories.push(category);
      const label: Label = getLabel(PostFilterType.Category, category.categoryId, category.name, category.color);
      controls.permanent.push(label);
    });
  } else if ((config.content.categories?.length || 0) <= 1) {
    searchableCategories = [...config.content.categories];
    config.content.categories.forEach(category => {
      const label: Label = getLabel(PostFilterType.Category, category.categoryId, category.name, category.color);
      controls.permanent.push(label);
    });
  } else {
    if (!searchModified?.filterCategoryIds?.length) {
      searchableCategories = [...config.content.categories];
    }
    var hasAny = false;
    var hasAnyEnabled = false;
    config.content.categories.forEach(category => {
      hasAny = true;
      const label: Label = getLabel(PostFilterType.Category, category.categoryId, category.name, category.color);
      controls.options.push(label);
      if ((!forceSingleCategory || !hasAnyEnabled) && searchModified?.filterCategoryIds?.includes(category.categoryId)) {
        hasAnyEnabled = true;
        controls.values.push(label);
        searchableCategories.push(category);
      }
    });
    if (hasAny) controls.groups++;
  }

  // sort
  if (!isFilterControllable(explorer, PostFilterType.Sort)) {
    const label: Label = getLabel(PostFilterType.Sort, explorer.search.sortBy!, explorer.search.sortBy!);
    controls.permanent.push(label);
  } else {
    controls.groups++;
    Object.keys(Client.IdeaSearchSortByEnum).filter(
      sortBy => sortBy !== Client.IdeaSearchSortByEnum.DragAndDrop
        && sortBy !== Client.IdeaSearchSortByEnum.Random
    ).forEach(sortBy => {
      const label: Label = getLabel(PostFilterType.Sort, sortBy, sortBy);
      controls.options.push(label);
      if (searchModified && searchModified.sortBy === sortBy) {
        controls.values.push(label);
      }
    });
  }

  // status
  if (!isFilterControllable(explorer, PostFilterType.Status)) {
    searchableCategories.forEach(category => {
      category.workflow.statuses.forEach(status => {
        if (explorer.search.filterStatusIds && explorer.search.filterStatusIds.includes(status.statusId)) {
          const label: Label = getLabel(PostFilterType.Status, status.statusId, status.name, status.color);
          controls.permanent.push(label);
        }
      })
    });
  } else {
    var hasAny = false;
    searchableCategories.forEach(category => {
      category.workflow.statuses.forEach(status => {
        hasAny = true;
        const label: Label = getLabel(PostFilterType.Status, status.statusId, status.name, status.color);
        controls.options.push(label);
        if (searchModified && searchModified.filterStatusIds && searchModified.filterStatusIds.includes(status.statusId)) {
          controls.values.push(label);
        }
      })
    });
    if (hasAny) controls.groups++;
  }

  // tag
  if (!isFilterControllable(explorer, PostFilterType.Tag)) {
    searchableCategories.forEach(category => {
      category.tagging.tags.forEach(tag => {
        if (explorer.search.filterTagIds && explorer.search.filterTagIds.includes(tag.tagId)) {
          const label: Label = getLabel(PostFilterType.Tag, tag.tagId, tag.name, tag.color);
          controls.permanent.push(label);
        }
      })
    });
  } else {
    var hasAny = false;
    const filterTagIds = new Set(explorer.search.filterTagIds);
    searchableCategories.forEach(category => {
      category.tagging.tagGroups.forEach(tagGroup => {
        const matchingCount: number = tagGroup.tagIds.reduce((count, nextTagId) => count + (filterTagIds.has(nextTagId) ? 1 : 0), 0);
        const permanent = matchingCount > 0
          && (tagGroup.minRequired || 0) <= matchingCount
          && (tagGroup.maxRequired || tagGroup.tagIds.length) >= matchingCount;
        tagGroup.tagIds.forEach(tagId => {
          const tag = category.tagging.tags.find(t => t.tagId === tagId);
          if (!tag) return;
          const label: Label = getLabel(tagGroup.name, tag.tagId, tag.name, tag.color);
          if (permanent) {
            controls.permanent.push(label);
          } else {
            hasAny = true;
            controls.options.push(label);
            if (searchModified && searchModified.filterTagIds && searchModified.filterTagIds.includes(tag.tagId)) {
              controls.values.push(label);
            }
          }
        })
      })
    });
    if (hasAny) controls.groups++;
  }

  // search is not added here

  return controls;
}
export const postLabelsToSearch = (labelValues: string[], forceSingleCategory?: boolean): Partial<Client.IdeaSearch> => {
  const partialSearch: Partial<Client.IdeaSearch> = {};
  labelValues.forEach(value => {
    const [type, data] = value.split(':');
    switch (type) {
      case PostFilterType.Search:
        partialSearch.searchText = data;
        break;
      case PostFilterType.Sort:
        partialSearch.sortBy = data as Client.IdeaSearchSortByEnum;
        break;
      case PostFilterType.Category:
        if (forceSingleCategory) {
          partialSearch.filterCategoryIds = [data];
        } else {
          if (!partialSearch.filterCategoryIds) partialSearch.filterCategoryIds = [];
          partialSearch.filterCategoryIds.push(data);
        }
        break;
      case PostFilterType.Status:
        if (!partialSearch.filterStatusIds) partialSearch.filterStatusIds = [];
        partialSearch.filterStatusIds.push(data);
        break;
      default:
        if (!partialSearch.filterTagIds) partialSearch.filterTagIds = [];
        partialSearch.filterTagIds.push(data);
        break;
    }
  });
  return partialSearch;
}
export const isFilterControllable = (explorer: Client.PageExplorer, type: PostFilterType | string): boolean => {
  switch (type) {
    case PostFilterType.Search:
      return explorer.allowSearch?.enableSearchText !== undefined ? explorer.allowSearch.enableSearchText : explorer.search.searchText === undefined;
    case PostFilterType.Sort:
      return explorer.allowSearch?.enableSort !== undefined ? explorer.allowSearch.enableSort : !explorer.search.sortBy;
    case PostFilterType.Category:
      return explorer.allowSearch?.enableSearchByCategory !== undefined ? explorer.allowSearch.enableSearchByCategory : (!explorer.search.filterCategoryIds || explorer.search.filterCategoryIds.length <= 0);
    case PostFilterType.Tag:
      return explorer.allowSearch?.enableSearchByTag !== undefined ? explorer.allowSearch.enableSearchByTag : true;
    case PostFilterType.Status:
      return explorer.allowSearch?.enableSearchByStatus !== undefined ? explorer.allowSearch.enableSearchByStatus : (!explorer.search.filterStatusIds || explorer.search.filterStatusIds.length <= 0);
    default:
      return true;
  }
}
const getLabel = (type: PostFilterType | string, data: string, name: string, color?: string): Label => {
  return {
    label: name,
    filterString: name,
    value: `${type}:${data}`,
    groupBy: type,
    color: color,
  };
}

/***
 ** USER
 */

export interface UserLabels {
  options: Label[];
  selected: Label[];
}
export const userSearchToLabels = (search?: Partial<Admin.UserSearchAdmin>): UserLabels => {
  const result: UserLabels = {
    options: [],
    selected: [],
  };

  const modOnly: Label = {
    groupBy: 'Filter',
    label: 'Moderators',
    value: 'Mods',
  };
  result.options.push(modOnly);
  if (search?.isMod) result.selected.push(modOnly);

  const sortCreated: Label = {
    groupBy: 'Sort',
    label: 'Created',
    value: Admin.UserSearchAdminSortByEnum.Created,
  }
  result.options.push(sortCreated);
  if (search?.sortBy === Admin.UserSearchAdminSortByEnum.Created) result.selected.push(sortCreated);

  const sortFundsAvailable: Label = {
    groupBy: 'Sort',
    label: 'Balance',
    value: Admin.UserSearchAdminSortByEnum.FundsAvailable,
  }
  result.options.push(sortFundsAvailable);
  if (search?.sortBy === Admin.UserSearchAdminSortByEnum.FundsAvailable) result.selected.push(sortFundsAvailable);

  const orderAsc: Label = {
    groupBy: 'Order',
    label: 'Ascending',
    value: Admin.UserSearchAdminSortOrderEnum.Asc,
  }
  result.options.push(orderAsc);
  if (search?.sortOrder === Admin.UserSearchAdminSortOrderEnum.Asc) result.selected.push(orderAsc);

  const orderDesc: Label = {
    groupBy: 'Order',
    label: 'Descending',
    value: Admin.UserSearchAdminSortOrderEnum.Desc,
  }
  result.options.push(orderDesc);
  if (search?.sortOrder === Admin.UserSearchAdminSortOrderEnum.Desc) result.selected.push(orderDesc);

  return result;
}
export const userLabelsToSearch = (labels: Label[]): Partial<Admin.UserSearchAdmin> => {
  const search: Partial<Admin.UserSearchAdmin> = {};
  labels.forEach(label => {
    if (label.groupBy === 'Filter') {
      if (label.value === 'Mods') search.isMod = true;
    }
    if (label.groupBy === 'Sort') {
      if (label.value === Admin.UserSearchAdminSortByEnum.Created) search.sortBy = Admin.UserSearchAdminSortByEnum.Created;
      if (label.value === Admin.UserSearchAdminSortByEnum.FundsAvailable) search.sortBy = Admin.UserSearchAdminSortByEnum.FundsAvailable;
    }
    if (label.groupBy === 'Order') {
      if (label.value === Admin.UserSearchAdminSortOrderEnum.Asc) search.sortOrder = Admin.UserSearchAdminSortOrderEnum.Asc;
      if (label.value === Admin.UserSearchAdminSortOrderEnum.Desc) search.sortOrder = Admin.UserSearchAdminSortOrderEnum.Desc;
    }
  });
  return search;
}

