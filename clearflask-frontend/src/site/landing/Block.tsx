import { Button, Grid, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { RouteComponentProps, withRouter } from 'react-router';
import DividerCorner from '../../app/utils/DividerCorner';

const styles = (theme: Theme) => createStyles({
  outer: {
    [theme.breakpoints.up('md')]: {
      padding: '10vh 10vw 10vh',
    },
    [theme.breakpoints.down('sm')]: {
      padding: '10vh 1vw 10vh',
    },
  },
  grid: {
    padding: theme.spacing(4),
    display: 'flex',
    flexDirection: 'column',
  },
  title: {
  },
  description: {
    marginTop: theme.spacing(2),
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
  },
  button: {
    alignSelf: 'flex-end',
  },
  image: {
    width: '100%',
  },
});

interface Props {
  className?: string;
  title?: string;
  description?: string;
  buttonTitle?: string;
  buttonLink?: string;
  controls?: React.ReactNode;
  demo?: React.ReactNode;
  imagePath?: string;
  icon?: React.ReactNode;
  mirror?: boolean;
}
class Block extends Component<Props & WithStyles<typeof styles, true> & RouteComponentProps> {

  render() {
    return (
      <Grid
        className={`${this.props.classes.outer} ${this.props.className || ''}`}
        container
        wrap='wrap-reverse'
        direction={!this.props.mirror ? 'row-reverse' : undefined}
        alignItems='center'
      >
        <Grid item xs={12} md={6} className={this.props.classes.grid} direction='column'>
          {this.props.imagePath && (
            <img
              className={this.props.classes.image}
              src={this.props.imagePath}
            />
          )}
          {this.props.demo}
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
        <Grid item xs={false} md={false} lg={1} xl={false} />
        <Grid item xs={12} sm={8} md={6} lg={5} xl={4} className={this.props.classes.grid}>
          {this.props.icon && (
            <div className={this.props.classes.icon}>
              {this.props.icon}
            </div>
          )}
          <Typography variant='h4' component='h3' className={this.props.classes.title}>{this.props.title}</Typography>
          <Typography variant='body1' component='div' className={this.props.classes.description}>{this.props.description}</Typography>
          {this.props.buttonLink && (
            <Button
              className={this.props.classes.button}
              variant='text'
              onClick={() => this.props.history.push(this.props.buttonLink!)}
            >{this.props.buttonTitle}</Button>
          )}
        </Grid>
      </Grid>
    );
  }
}

export default withStyles(styles, { withTheme: true })(withRouter(Block));
