import { IconButton } from '@material-ui/core';
import { createStyles, Theme, WithStyles, withStyles } from '@material-ui/core/styles';
import MoreIcon from '@material-ui/icons/MoreHoriz';
import React, { Component } from 'react';
import { MaxContentWidth, MinContentWidth } from './Post';

const styles = (theme: Theme) => createStyles({
  container: {
    width: MinContentWidth,
    minWidth: MinContentWidth,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadMore: {
    margin: 'auto',
  },
});

interface Props {
  onClick: () => void;
}

class LoadMoreButton extends Component<Props & WithStyles<typeof styles, true>> {
  render() {
    return (
      <div className={this.props.classes.container}>
        <IconButton
          className={this.props.classes.loadMore}
          onClick={this.props.onClick.bind(this)}
        >
          <MoreIcon />
        </IconButton>
      </div>
    );
  }
}

export default withStyles(styles, { withTheme: true })(LoadMoreButton);
