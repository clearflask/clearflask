import { Grid, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';

const styles = (theme: Theme) => createStyles({
  hero: {
    width: '100vw',
    minHeight: '90vh',
    padding: '20vh 10vw',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroLogo: {
    [theme.breakpoints.up('md')]: {
      width: '200px',
      height: '200px',
    },
    [theme.breakpoints.down('sm')]: {
      width: '200px',
      height: '200px',
      opacity: 0.1,
    },
  },
  heroDescription: {
    marginTop: theme.spacing(2),
    color: theme.palette.text.hint,
  },
  image: {
    padding: theme.spacing(4),
    width: '100%',
  },
});

interface Props {
  title?: string;
  description?: string;
  imagePath?: string;
}
class Hero extends Component<Props & WithStyles<typeof styles, true>> {

  render() {
    return (
      <div className={this.props.classes.hero}>
        <Grid container justify='center' wrap='wrap-reverse' alignItems='center'>
          {this.props.imagePath && (
            <Grid item xs={12} md={6}>
              <img
                alt=''
                className={this.props.classes.image}
                src={this.props.imagePath}
              />
            </Grid>
          )}
          <Grid item xs={12} md={6}>
            <Typography variant='h3' component='h1'>
              {this.props.title}
            </Typography>
            <Typography variant='h5' component='h2' className={this.props.classes.heroDescription}>
              {this.props.description}
            </Typography>
          </Grid>
        </Grid>
      </div>
    );
  }
}

export default withStyles(styles, { withTheme: true })(Hero);
