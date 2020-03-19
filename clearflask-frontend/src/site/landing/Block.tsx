import { Grid, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';

const styles = (theme: Theme) => createStyles({
  box: {
    margin: theme.spacing(4),
    padding: theme.spacing(2),
  },
  description: {
    color: theme.palette.text.hint,
  },
  icon: {
    position: 'absolute',
    transform: 'translate(-100%, -100%)',
  }
});

interface Props {
  className?: string;
  title?: string;
  description?: string;
  controls?: React.ReactNode;
  demo?: React.ReactNode;
  icon?: React.ReactNode;
  mirror?: boolean;
}
class Block extends Component<Props & WithStyles<typeof styles, true>> {

  render() {
    return (
      <Grid
        className={this.props.className}
        container
        spacing={3}
        wrap='wrap-reverse'
        direction={!this.props.mirror ? 'row-reverse' : undefined}
      >
        <Grid item xs={12} md={6}>
          {this.props.demo}
        </Grid>
        <Grid item xs={false} sm={false} md={2} lg={1} xl={false} />
        <Grid item xs={12} md={4} lg={3} xl={2}>
          {this.props.icon && (
            <div className={this.props.classes.icon}>
              {this.props.icon}
            </div>
          )}
          <Typography variant='h5' component='h3'>{this.props.title}</Typography>
          <br />
          <Typography variant='subtitle1' component='div'>{this.props.description}</Typography>
          <br />
          {this.props.controls}
        </Grid>
      </Grid>
    );
  }
}

export default withStyles(styles, { withTheme: true })(Block);
