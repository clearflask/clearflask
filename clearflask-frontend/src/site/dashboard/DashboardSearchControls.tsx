import { InputBase } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import SearchIcon from '@material-ui/icons/Search';
import React, { Component } from 'react';
import debounce, { SearchTypeDebounceTime } from '../../common/util/debounce';

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
  searchText?: string;
  onSearchChanged: (searchText?: string) => void;
}
interface State {
  searchText?: string;
}
class DashboardSearchControls extends Component<Props & WithStyles<typeof styles, true>, State> {
  readonly onSearchChanged: (searchText?: string) => void;

  constructor(props) {
    super(props);

    this.state = { searchText: props.searchText };

    this.onSearchChanged = debounce(this.props.onSearchChanged, SearchTypeDebounceTime);
  }

  render() {
    return (
      <div className={this.props.classes.search}>
        <SearchIcon
          className={this.props.classes.searchIcon}
          color='inherit'
        />
        <InputBase
          className={this.props.classes.searchText}
          placeholder='Search by any field'
          fullWidth
          value={this.state.searchText || ''}
          onChange={e => {
            const newSearchText = e.target.value === '' ? undefined : e.target.value;
            this.setState({ searchText: newSearchText });
            this.onSearchChanged(newSearchText);
          }}
        />
      </div>
    );
  }
}

export default withStyles(styles, { withTheme: true })(DashboardSearchControls);
