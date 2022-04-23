// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import classNames from 'classnames';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import * as Admin from '../../api/admin';
import * as Client from '../../api/client';
import { ReduxState, Server } from '../../api/server';
import PostFilterControls from '../../common/search/PostFilterControls';
import { LabelGroup, PostFilterType } from '../../common/search/searchUtil';
import { customShouldComponentUpdate } from '../../common/util/reactUtil';

const styles = (theme: Theme) => createStyles({
  horizontal: {
    display: 'flex',
    flexWrap: 'wrap',
  },
});
interface Props {
  server: Server;
  search?: Partial<Admin.IdeaSearchAdmin>;
  onSearchChanged: (search: Partial<Admin.IdeaSearchAdmin>) => void;
  allowSearch?: Partial<Admin.PageExplorerAllOfAllowSearch>;
  permanentSearch?: Admin.IdeaSearch;
  allowSearchMultipleCategories?: boolean;
  sortByDefault?: Admin.IdeaSearchAdminSortByEnum;
  horizontal?: boolean;
}
interface ConnectProps {
  config?: Client.Config;
}
interface State {
}
class DashboardPostFilterControls extends Component<Props & ConnectProps & WithStyles<typeof styles, true>, State> {
  state: State = {};

  shouldComponentUpdate = customShouldComponentUpdate({
    nested: new Set(['search', 'allowSearch', 'permanentSearch']),
    presence: new Set(['onSearchChanged']),
  });

  render() {
    return (
      <PostFilterControls
        className={classNames(this.props.horizontal && this.props.classes.horizontal)}
        config={this.props.config}
        explorer={{
          allowSearch: {
            enableSort: true,
            enableSearchText: true,
            enableSearchByCategory: true,
            enableSearchByStatus: true,
            enableSearchByTag: true,
            ...this.props.allowSearch,
          },
          display: {},
          search: this.props.permanentSearch || {},
        }}
        forceSingleCategory={!this.props.allowSearchMultipleCategories}
        search={{
          ...this.props.search,
          ...(this.props.allowSearchMultipleCategories ? {} : {
            // This along with forceSingleCategory ensures one and only one category is selected
            filterCategoryIds: this.props.search?.filterCategoryIds?.length
              ? this.props.search.filterCategoryIds
              : (this.props.config?.content.categories.length
                ? [this.props.config?.content.categories[0]?.categoryId]
                : undefined),
          }),
          // Sort by default
          sortBy: this.props.search?.sortBy || this.props.sortByDefault || Admin.IdeaSearchAdminSortByEnum.New,
        }}
        sortGroups={(a, b) => this.getLabelGroupSortOrder(b) - this.getLabelGroupSortOrder(a)}
        onSearchChanged={this.props.onSearchChanged}
      />
    );
  }

  getLabelGroupSortOrder(group: LabelGroup): number {
    if (group.filterType === PostFilterType.Search) return 1000;
    if (group.filterType === PostFilterType.Category) return 900;
    if (group.groupName === 'Subcategory') return 800;
    if (group.filterType === PostFilterType.Sort) return 700;
    if (group.filterType === PostFilterType.Tag) return 600;
    if (group.filterType === PostFilterType.Status) return 500;
    return 0;
  }
}

export default connect<ConnectProps, {}, Props, ReduxState>((state, ownProps) => {
  const newProps: ConnectProps = {
    config: state.conf.conf,
  };
  return newProps;
}, null, null, { forwardRef: true })(withStyles(styles, { withTheme: true })(DashboardPostFilterControls));
