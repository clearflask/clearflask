import { Grid, Paper, Typography } from '@material-ui/core';
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
  },
  beta: {
    color: theme.palette.text.hint,
  },
});

interface Props {
  title?: string;
  description?: string;
  beta?: boolean;
  icon?: React.ReactNode;
}
class Feature extends Component<Props & WithStyles<typeof styles, true>> {

  render() {
    return (
      <Grid item xs={12} sm={6} md={4}>
        <Paper elevation={0} className={this.props.classes.box}>
          {this.props.icon && (
            <div className={this.props.classes.icon}>
              {this.props.icon}
            </div>
          )}
          <Typography variant='h5'>
            {this.props.title}
            {this.props.beta && (
              <Typography variant='caption' className={this.props.classes.beta}>BETA</Typography>
            )}
          </Typography>
          <Typography gutterBottom className={this.props.classes.description}>
            {this.props.description}
          </Typography>
        </Paper>
      </Grid>
    );
  }
}

export default withStyles(styles, { withTheme: true })(Feature);
