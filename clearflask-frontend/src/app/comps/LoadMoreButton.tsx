import { IconButton } from '@material-ui/core';
import { createStyles, Theme, WithStyles, withStyles } from '@material-ui/core/styles';
import MoreIcon from '@material-ui/icons/MoreHoriz';
import React, { Component } from 'react';

const styles = (theme: Theme) => createStyles({
  loadMore: {
    margin: 'auto',
    alignSelf: 'center',
  },
});

interface Props {
  onClick: () => void;
}

class LoadMoreButton extends Component<Props & WithStyles<typeof styles, true>> {
  render() {
    return (
      <IconButton
        className={this.props.classes.loadMore}
        onClick={this.props.onClick.bind(this)}
      >
        <MoreIcon />
      </IconButton>
    );
  }
}

export default withStyles(styles, { withTheme: true })(LoadMoreButton);
