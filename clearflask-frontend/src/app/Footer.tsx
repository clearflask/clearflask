import { Divider } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import PoweredBy from './PoweredBy';

const styles = (theme: Theme) => createStyles({
  footer: {
    width: '100%',
    maxWidth: '1024px',
    margin: '0px auto',
    padding: theme.spacing(1),
  },
  grow: {
    flexGrow: 1,
  },
  footerItems: {
    display: 'flex',
    alignItems: 'center',
  },
});

class Footer extends Component<WithStyles<typeof styles, true>> {
  render() {
    return (
      <div className={this.props.classes.footer}>
        <Divider />
        <div className={this.props.classes.footerItems}>
          <div className={this.props.classes.grow} />
          <PoweredBy />
        </div>
      </div>
    );
  }
}

export default withStyles(styles, { withTheme: true })(Footer);
