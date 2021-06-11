import { IconButton, InputBase } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import SearchIcon from '@material-ui/icons/Search';
import FilterIcon from '@material-ui/icons/TuneSharp';
import React, { Component } from 'react';
import ClosablePopper from '../../common/ClosablePopper';
import debounce, { SearchTypeDebounceTime } from '../../common/util/debounce';

const styles = (theme: Theme) => createStyles({
  search: {
    display: 'flex',
    alignItems: 'center',
    color: theme.palette.text.hint,
  },
  searchIcon: {
    margin: theme.spacing(2),
    marginRight: 0,
  },
  filterIcon: {
    margin: theme.spacing(.5),
    marginLeft: 0,
  },
  searchText: {
    margin: theme.spacing(1.5),
  },
});
interface Props {
  searchText?: string;
  onSearchChanged: (searchText?: string) => void;
  filters?: React.ReactNode;
}
interface State {
  searchText?: string;
  filtersOpen?: boolean;
}
class DashboardSearchControls extends Component<Props & WithStyles<typeof styles, true>, State> {
  readonly onSearchChanged: (searchText?: string) => void;
  filtersAnchorRef: React.RefObject<any> = React.createRef();

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
        {this.props.filters && (
          <>
            <IconButton
              className={this.props.classes.filterIcon}
              onClick={() => this.setState({ filtersOpen: !this.state.filtersOpen })}
              ref={this.filtersAnchorRef}
            >
              <FilterIcon />
            </IconButton>
            <ClosablePopper
              disableCloseButton
              open={!!this.state.filtersOpen}
              onClose={() => this.setState({ filtersOpen: false })}
              placement='top'
              anchorEl={this.filtersAnchorRef.current}
              arrow
              clickAway
            >
              {this.props.filters}
            </ClosablePopper>
          </>
        )}
      </div>
    );
  }
}

export default withStyles(styles, { withTheme: true })(DashboardSearchControls);
