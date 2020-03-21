import { Grid, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import DividerCorner from '../../app/utils/DividerCorner';

const styles = (theme: Theme) => createStyles({
  grid: {
    padding: theme.spacing(4),
  },
  description: {
    color: theme.palette.text.hint,
  },
  icon: {
    position: 'absolute',
    transform: 'translate(-100%, -100%)',
  },
  controlsOuter: {
    margin: theme.spacing(3),
  },
  controlsInner: {
    margin: theme.spacing(4),
    display: 'flex',
    flexDirection: 'column',
  },
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
        wrap='wrap-reverse'
        direction={!this.props.mirror ? 'row-reverse' : undefined}
      >
        <Grid item xs={12} sm={6} md={6} className={this.props.classes.grid} direction='column'>
          <div>
            {this.props.demo}
          </div>
          {this.props.controls && (
            <DividerCorner
              className={this.props.classes.controlsOuter}
              width='160px'
              height='40px'
            >
              <div className={this.props.classes.controlsInner}>
                {this.props.controls}
              </div>
            </DividerCorner>
          )}
        </Grid>
        <Grid item xs={false} sm={false} md={2} lg={1} xl={false} />
        <Grid item xs={12} sm={6} md={4} lg={3} xl={2} className={this.props.classes.grid}>
          {this.props.icon && (
            <div className={this.props.classes.icon}>
              {this.props.icon}
            </div>
          )}
          <Typography variant='h5' component='h3'>{this.props.title}</Typography>
          <br />
          <Typography variant='subtitle1' component='div'>{this.props.description}</Typography>
        </Grid>
      </Grid>
    );
  }
}

export default withStyles(styles, { withTheme: true })(Block);
