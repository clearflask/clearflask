import { Container, Grid, Typography } from '@material-ui/core';
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
});

interface Props {
  title?: string;
  description?: string;
  image?: React.ReactNode;
}
class Hero extends Component<Props & WithStyles<typeof styles, true>> {

  render() {
    return (
      <div className={this.props.classes.hero}>
        <Container maxWidth='md'>
          <Grid container justify='center' wrap='wrap-reverse'>
            <Grid item sm={1} md={4}>
              {this.props.image}
            </Grid>
            <Grid item xs={12} sm={11} md={8}>
              <Typography variant='h3' component='h1'>
                {this.props.title}
              </Typography>
              <Typography variant='h5' component='h2' className={this.props.classes.heroDescription}>
                {this.props.description}
              </Typography>
            </Grid>
          </Grid>
        </Container>
      </div>
    );
  }
}

export default withStyles(styles, { withTheme: true })(Hero);
