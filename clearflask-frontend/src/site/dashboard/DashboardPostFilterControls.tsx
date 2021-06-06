import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import * as Admin from '../../api/admin';
import * as Client from '../../api/client';
import { ReduxState, Server } from '../../api/server';
import PostFilterControls from '../../common/search/PostFilterControls';
import { LabelGroup, PostFilterType } from '../../common/search/searchUtil';

const styles = (theme: Theme) => createStyles({
  search: {
    display: 'flex',
    alignItems: 'center',
    margin: theme.spacing(2),
    color: theme.palette.text.hint,
  },
  searchIcon: {
    marginRight: theme.spacing(2),
  },
  searchText: {
  },
});
interface Props {
  server: Server;
  search?: Partial<Admin.IdeaSearchAdmin>;
  onSearchChanged: (search: Partial<Admin.IdeaSearchAdmin>) => void;
}
interface ConnectProps {
  config?: Client.Config;
}
interface State {
}
class DashboardPostFilterControls extends Component<Props & ConnectProps & WithStyles<typeof styles, true>, State> {
  state: State = {};

  render() {
    return (
      <PostFilterControls
        config={this.props.config}
        explorer={{
          allowSearch: {
            enableSort: true,
            enableSearchText: true,
            enableSearchByCategory: true,
            enableSearchByStatus: true,
            enableSearchByTag: true,
          },
          display: {},
          search: {},
        }}
        forceSingleCategory
        search={{
          ...this.props.search,
          // This along with forceSingleCategory ensures one and only one category is selected
          filterCategoryIds: this.props.search?.filterCategoryIds?.length
            ? this.props.search.filterCategoryIds
            : (this.props.config?.content.categories.length
              ? [this.props.config?.content.categories[0]?.categoryId]
              : undefined),
          // Sort by new by default
          sortBy: this.props.search?.sortBy || Admin.IdeaSearchAdminSortByEnum.New,
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
