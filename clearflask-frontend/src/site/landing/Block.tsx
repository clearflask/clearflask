import { Grid } from '@material-ui/core';
import { createStyles, Theme, WithStyles, withStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { RouteComponentProps, withRouter } from 'react-router';
import DividerCorner from '../../app/utils/DividerCorner';
import BlockContent, { Props as BlockContentProps } from './BlockContent';

const styles = (theme: Theme) => createStyles({
  heroSpacing: {
    [theme.breakpoints.up('md')]: {
      padding: '20vh 10vw',
    },
    [theme.breakpoints.down('sm')]: {
      padding: '10vh 1vw',
    },
  },
  spacing: {
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
  columnOnly: {
    display: 'flex',
    flexDirection: 'column',
  },
  columnContent: {
    marginBottom: theme.spacing(4),
  },
  demoShadow: {
    boxShadow: '-10px -10px 40px 0 rgba(0,0,0,0.04)',
  },
});

export interface Props extends BlockContentProps {
  className?: string;
  type?: 'largeDemo' | 'hero' | 'column';
  title?: string;
  description?: string;
  buttonTitle?: string;
  buttonLink?: string;
  controls?: React.ReactNode;
  demo?: React.ReactNode;
  imagePath?: string;
  icon?: React.ReactNode;
  mirror?: boolean;
  suppressShadow?: boolean;
}
class Block extends Component<Props & WithStyles<typeof styles, true> & RouteComponentProps> {

  render() {
    const isHero = this.props.type === 'hero';
    var blockVariant;
    switch (this.props.type) {
      case 'hero':
        blockVariant = 'hero';
        break;
      default:
      case 'largeDemo':
        blockVariant = 'heading';
        break;
      case 'column':
        blockVariant = 'content';
        break;
    }
    const content = (
      <BlockContent
        variant={blockVariant}
        {...this.props as BlockContentProps}
      />
    );
    const display = (
      <React.Fragment>
        {this.props.imagePath && (
          <img
            alt=''
            className={this.props.classes.image}
            src={this.props.imagePath}
          />
        )}
        {this.props.demo && (
          <div className={this.props.suppressShadow ? undefined : this.props.classes.demoShadow}>
            {this.props.demo}
          </div>
        )}
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
      </React.Fragment>
    );

    if (this.props.type === 'column') {
      return (
        <div
          className={`${this.props.classes.columnOnly} ${this.props.className || ''}`}
        >
          <div className={this.props.classes.columnContent}>
            {content}
          </div>
          {display}
        </div>
      );
    } else {
      const isLargeDemo = this.props.type === 'largeDemo';
      return (
        <Grid
          className={`${isHero ? this.props.classes.heroSpacing : this.props.classes.spacing} ${this.props.className || ''}`}
          container
          wrap='wrap-reverse'
          direction={!this.props.mirror ? 'row-reverse' : undefined}
          alignItems={(this.props.imagePath || isHero) ? 'center' : 'flex-end'}
          justify='center'
        >
          <Grid item xs={12} md={isLargeDemo ? 8 : 6} className={this.props.classes.grid} direction='column'>
            {display}
          </Grid>
          <Grid item xs={12} sm={8} md={isLargeDemo ? 4 : 6} lg={isLargeDemo ? 3 : 5} xl={isLargeDemo ? 2 : 4} className={this.props.classes.grid}>
            {content}
          </Grid>
        </Grid>
      );
    }
  }
}

export default withStyles(styles, { withTheme: true })(withRouter(Block));
