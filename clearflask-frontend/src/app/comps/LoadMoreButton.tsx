import { Button, Typography } from '@material-ui/core';
import { createStyles, Theme, WithStyles, withStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';

const styles = (theme: Theme) => createStyles({
  loadMore: {
  },
});

interface Props {
  onClick: () => void;
}

class LoadMoreButton extends Component<Props & WithStyles<typeof styles, true>> {
  render() {
    return (
      <Button
        variant='text'
        className={this.props.classes.loadMore}
        onClick={this.props.onClick.bind(this)}>
        <Typography variant='caption'>See more</Typography>
      </Button>
    );
  }
}

export default withStyles(styles, { withTheme: true })(LoadMoreButton);
