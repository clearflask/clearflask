import { InputBase } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import SearchIcon from '@material-ui/icons/Search';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import * as Admin from '../../api/admin';
import * as Client from '../../api/client';
import { ReduxState, Server } from '../../api/server';
import PostFilterControls from '../../common/search/PostFilterControls';

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
  type: 'search' | 'filter';
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
    return this.props.type === 'search' ? (
      <div className={this.props.classes.search}>
        <SearchIcon
          className={this.props.classes.searchIcon}
          color='inherit'
        />
        <InputBase
          className={this.props.classes.searchText}
          placeholder='Search by any field'
          fullWidth
          value={this.props.search?.searchText || ''}
          onChange={e => this.props.onSearchChanged({ searchText: e.target.value })}
        />
      </div>
    ) : (
      <PostFilterControls
        config={this.props.config}
        forceSingleCategory
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
        search={this.props.search}
        onSearchChanged={this.props.onSearchChanged}
      />
    );
  }
}

export default connect<ConnectProps, {}, Props, ReduxState>((state, ownProps) => {
  const newProps: ConnectProps = {
    config: state.conf.conf,
  };
  return newProps;
}, null, null, { forwardRef: true })(withStyles(styles, { withTheme: true })(DashboardPostFilterControls));
