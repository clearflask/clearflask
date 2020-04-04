import { Link } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';

const styles = (theme: Theme) => createStyles({
  container: {
    margin: theme.spacing(1),
    display: 'flex',
    fontSize: '0.9em',
  },
  poweredBy: {
    color: theme.palette.text.hint,
  },
  name: {
    color: theme.palette.text.primary,
  },
});

class PoweredBy extends Component<WithStyles<typeof styles, true>> {

  render() {
    return (
      <Link underline='none' target="_blank" href='https://clearflask.com/'>
        <div className={this.props.classes.container}>
          <div className={this.props.classes.poweredBy}>Powered by&nbsp;</div>
          <div className={this.props.classes.name}>ClearFlask</div>
        </div>
      </Link>
    );
  }
}

export default withStyles(styles, { withTheme: true })(PoweredBy);
