import { Grid } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { RouteComponentProps, withRouter } from 'react-router';
import DividerCorner from '../../app/utils/DividerCorner';
import BlockContent, { Props as BlockContentProps } from './BlockContent';

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
  controlsOuter: {
    margin: theme.spacing(3),
  },
  controlsInner: {
    margin: theme.spacing(4),
  },
  image: {
    width: '100%',
  },
});

export interface Props {
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
  largeDemo?: boolean;
}
class Block extends Component<Props & BlockContentProps & WithStyles<typeof styles, true> & RouteComponentProps> {

  render() {
    return (
      <Grid
        className={`${this.props.classes.outer} ${this.props.className || ''}`}
        container
        wrap='wrap-reverse'
        direction={!this.props.mirror ? 'row-reverse' : undefined}
        alignItems={this.props.imagePath ? 'center' : 'flex-end'}
      >
        <Grid item xs={12} md={this.props.largeDemo ? 12 : 6} className={this.props.classes.grid} direction='column'>
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
        <Grid item xs={12} md={this.props.largeDemo ? 12 : 6} lg={this.props.largeDemo ? 3 : 5} xl={this.props.largeDemo ? 2 : 4} className={this.props.classes.grid}>
          <BlockContent {...this.props as BlockContentProps} />
        </Grid>
      </Grid>
    );
  }
}

export default withStyles(styles, { withTheme: true })(withRouter(Block));
