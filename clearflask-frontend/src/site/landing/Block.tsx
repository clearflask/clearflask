import { Grid, GridItemsAlignment } from '@material-ui/core';
import { createStyles, Theme, WithStyles, withStyles } from '@material-ui/core/styles';
import classNames from 'classnames';
import React, { Component } from 'react';
import { RouteComponentProps, withRouter } from 'react-router';
import DividerCorner from '../../app/utils/DividerCorner';
import ImgIso from '../../common/ImgIso';
import { vh } from '../../common/util/screenUtil';
import BlockContent, { Props as BlockContentProps } from './BlockContent';

const styles = (theme: Theme) => createStyles({
  heroSpacing: {
    [theme.breakpoints.up('md')]: {
      padding: `${vh(20)}px 10vw`,
    },
    [theme.breakpoints.down('sm')]: {
      padding: `${vh(10)}px 1vw`,
    },
  },
  spacing: {
    [theme.breakpoints.up('md')]: {
      padding: `${vh(10)}px 10vw ${vh(10)}px`,
    },
    [theme.breakpoints.down('sm')]: {
      padding: `${vh(10)}px 1vw ${vh(10)}px`,
    },
  },
  grid: {
    padding: theme.spacing(4),
    display: 'flex',
    flexDirection: 'column',
  },
  controlsOuter: {
    margin: theme.spacing(3),
    float: 'right',
  },
  controlsInner: {
    margin: theme.spacing(4),
  },
  image: {
    padding: theme.spacing(8),
    width: '100%',
    [theme.breakpoints.up('md')]: {
      padding: theme.spacing(8),
    },
    [theme.breakpoints.down('sm')]: {
      padding: theme.spacing(8, 2),
    },
  },
  columnOnly: {
    display: 'flex',
    flexDirection: 'column',
  },
  columnContent: {
    marginBottom: theme.spacing(4),
  },
  edgeshadow: { // from edgeType prop
    boxShadow: '0px 0px 40px 0 rgba(0,0,0,0.04)',
    width: 'fit-content',
    alignSelf: 'center',
  },
  edgeoutline: { // from edgeType prop
    boxShadow: '0px 0px 40px 0 rgba(0,0,0,0.2)',
    border: '1px solid ' + theme.palette.grey[300],
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'center',
  },
});

export interface Props extends BlockContentProps {
  className?: string;
  type?: 'largeDemo' | 'hero' | 'column' | 'demoOnly';
  controls?: React.ReactNode;
  demo?: React.ReactNode;
  image?: Img;
  imagePath?: string;
  imageLocation?: 'demo' | 'above';
  imageStyle?: React.CSSProperties;
  imageStyleOuter?: React.CSSProperties;
  icon?: React.ReactNode;
  mirror?: boolean;
  edgeType?: 'shadow' | 'outline';
  noSpacing?: boolean;
  displayAlign?: GridItemsAlignment;
  alignItems?: GridItemsAlignment;
}
class Block extends Component<Props & WithStyles<typeof styles, true> & RouteComponentProps> {

  render() {
    const isHero = this.props.type === 'hero';

    const imageSrc = this.props.image?.src || this.props.imagePath;
    var image = imageSrc && (
      <ImgIso
        alt=''
        className={this.props.classes.image}
        src={imageSrc}
        aspectRatio={this.props.image?.aspectRatio}
        width={!this.props.image?.aspectRatio ? '100%' : undefined}
        maxWidth={this.props.image?.width}
        maxHeight={this.props.image?.height}
        style={this.props.imageStyle}
        styleOuter={this.props.imageStyleOuter}
      />
    );

    var demo = this.props.demo;
    if (demo && this.props.edgeType) {
      demo = (
        <div className={classNames(this.props.edgeType ? this.props.classes['edge' + this.props.edgeType] : '')}>
          {demo}
        </div>
      );
    }
    const display = (
      <React.Fragment>
        {!!image && (!this.props.imageLocation || this.props.imageLocation === 'demo') && image}
        {demo}
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

    if (this.props.type === 'demoOnly') {
      return (
        <div
          className={classNames(!this.props.noSpacing && this.props.classes.spacing, this.props.className)}
        >
          {display}
        </div>
      );
    }

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
    const { classes, ...blockContentProps } = this.props;
    const content = (
      <BlockContent
        variant={blockVariant}
        {...blockContentProps}
      />
    );

    if (this.props.type === 'column') {
      return (
        <div
          className={`${this.props.classes.columnOnly} ${this.props.className || ''}`}
        >
          <div className={this.props.classes.columnContent}>
            {!!image && this.props.imageLocation === 'above' && image}
            {content}
          </div>
          {display}
        </div>
      );
    } else {
      const isLargeDemo = this.props.type === 'largeDemo';
      return (
        <Grid
          className={classNames(!this.props.noSpacing && (isHero ? this.props.classes.heroSpacing : this.props.classes.spacing), this.props.className)}
          container
          wrap='wrap-reverse'
          direction={!this.props.mirror ? 'row-reverse' : undefined}
          alignItems={this.props.alignItems !== undefined ? this.props.alignItems
            : ((this.props.imagePath || isHero) ? 'center' : 'flex-end')}
          justify='center'
        >
          <Grid alignItems={this.props.displayAlign || 'center'} item xs={12} md={isLargeDemo ? 12 : 6} className={classNames(this.props.classes.grid)}>
            {display}
          </Grid>
          <Grid alignItems='center' item xs={12} sm={8} md={6} lg={5} xl={4} className={this.props.classes.grid}>
            {!!image && !isLargeDemo && this.props.imageLocation === 'above' && image}
            {content}
          </Grid>
          {!!image && isLargeDemo && this.props.imageLocation === 'above' && (
            <Grid alignItems='center' item xs={12} sm={8} md={6} lg={5} xl={4} className={this.props.classes.grid}>
              {image}
            </Grid>
          )}
        </Grid>
      );
    }
  }
}

export default withRouter(withStyles(styles, { withTheme: true })(Block));
