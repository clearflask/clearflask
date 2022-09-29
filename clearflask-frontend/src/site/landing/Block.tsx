// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { Grid, GridItemsAlignment } from '@material-ui/core';
import { createStyles, Theme, WithStyles, withStyles } from '@material-ui/core/styles';
import classNames from 'classnames';
import React, { Component } from 'react';
import { RouteComponentProps, withRouter } from 'react-router';
import FakeBrowser from '../../common/FakeBrowser';
import ImgIso from '../../common/ImgIso';
import BlockContent, { Props as BlockContentProps } from './BlockContent';

const styles = (theme: Theme) => createStyles({
  heroSpacing: {
    minHeight: theme.vh(40),
    padding: `${theme.vh(10)}px 10vw`,
    display: 'flex',
    justifyContent: 'center',
  },
  spacing: {
    [theme.breakpoints.up('md')]: {
      padding: `${theme.vh(10)}px 10vw`,
    },
    [theme.breakpoints.down('sm')]: {
      padding: `${theme.vh(10)}px 1vw`,
    },
  },
  spacingMediumDemo: {
    [theme.breakpoints.up('lg')]: {
      padding: `${theme.vh(10)}px 10vw`,
    },
    [theme.breakpoints.down('md')]: {
      padding: `${theme.vh(10)}px 1vw`,
    },
  },
  grid: {
    padding: theme.spacing(4),
    display: 'flex',
    flexDirection: 'column',
  },
  controlsTop: {
    marginBottom: theme.spacing(4),
    display: 'flex',
    justifyContent: 'center',
  },
  controlsBottomRight: {
    float: 'right',
    marginTop: theme.spacing(4),
  },
  demoImage: {
    width: '100%',
  },
  image: {
    width: '100%',
    padding: theme.spacing(0, 8, 0),
    [theme.breakpoints.down('sm')]: {
      padding: theme.spacing(0, 2, 0),
    },
  },
  columnOnly: {
    display: 'flex',
    flexDirection: 'column',
  },
  columnContent: {
    marginBottom: theme.spacing(4),
  },
  boxShadow: {
    boxShadow: '0px 0px 40px 0 rgba(0,0,0,0.2)',
  },
  fakeBrowser: {
    margin: 'auto',
  },
});

export interface Props extends Omit<BlockContentProps, 'variant'> {
  className?: string;
  type?: 'largeDemo' | 'mediumDemo' | 'hero' | 'column' | 'headingMain' | 'demoOnly' | 'headingOnly';
  controls?: React.ReactNode;
  controlsLocation?: 'bottom-right' | 'top';
  demo?: React.ReactNode;
  demoImage?: Img;
  demoWrap?: 'browser' | 'browser-dark' | 'shadow',
  demoWrapBrowserUrl?: string,
  demoWrapBrowserProps?: Partial<React.ComponentProps<typeof FakeBrowser>>;
  demoWrapPadding?: number | string,
  demoFixedHeight?: number;
  demoFixedWidth?: number | string;
  image?: Img;
  imageScale?: number;
  imagePath?: string;
  imageLocation?: 'demo' | 'above';
  imageStyle?: React.CSSProperties;
  imageStyleOuter?: React.CSSProperties;
  mirror?: boolean;
  edgeType?: 'shadow' | 'outline';
  noSpacing?: boolean;
  spacingTop?: string | number;
  spacingBottom?: string | number;
  spacingTopBottom?: string | number;
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
        scale={this.props.imageScale}
        width={!this.props.image?.aspectRatio ? '100%' : undefined}
        maxWidth={this.props.image?.width}
        maxHeight={this.props.image?.height}
        style={this.props.imageStyle}
        styleOuter={this.props.imageStyleOuter}
      />
    );

    var demo = this.props.demo;
    if (this.props.demoImage) {
      demo = (
        <ImgIso
          alt=''
          className={this.props.classes.demoImage}
          src={this.props.demoImage.src}
          aspectRatio={this.props.demoImage?.aspectRatio}
          width={!this.props.demoImage?.aspectRatio ? '100%' : undefined}
          maxWidth={this.props.demoImage?.width}
          maxHeight={this.props.demoImage?.height}
        />
      );

    }
    if (demo && this.props.edgeType) {
      demo = (
        <div className={classNames(this.props.edgeType ? this.props.classes['edge' + this.props.edgeType] : '')}>
          {demo}
        </div>
      );
    }
    const demoFixedWidth = this.props.demoFixedWidth || (this.props.demoImage ? '100%' : undefined);
    const demoFixedHeight = this.props.demoFixedHeight;
    const demoWrapPadding = this.props.demoWrapPadding;
    if (this.props.demoWrap === 'browser' || this.props.demoWrap === 'browser-dark') {
      const isDark = this.props.demoWrap === 'browser-dark';
      demo = (
        <FakeBrowser
          className={this.props.classes.fakeBrowser}
          addressBarContent={this.props.demoWrapBrowserUrl}
          darkMode={isDark}
          contentPadding={demoWrapPadding}
          fixedWidth={demoFixedWidth}
          fixedHeight={demoFixedHeight}
          {...this.props.demoWrapBrowserProps}
        >
          {demo}
        </FakeBrowser>
      );
    } else {
      demo = (
        <div
          className={classNames(
            this.props.demoWrap === 'shadow' && this.props.classes.boxShadow,
          )}
          style={{
            padding: demoWrapPadding,
            width: demoFixedWidth,
            height: demoFixedHeight,
          }}
        >
          {demo}
        </div>
      );
    }

    const display = (
      <>
        {!!image && (!this.props.imageLocation || this.props.imageLocation === 'demo') && image}
        {!!this.props.controls && this.props.controlsLocation === 'top' && (
          <div className={this.props.classes.controlsTop}>
            {this.props.controls}
          </div>
        )}
        {demo}
        {!!this.props.controls && (!this.props.controlsLocation || this.props.controlsLocation === 'bottom-right') && (
          <div className={this.props.classes.controlsBottomRight}>
            {this.props.controls}
          </div>
        )}
      </>
    );

    const spacingClassname = classNames(!this.props.noSpacing && (isHero
      ? this.props.classes.heroSpacing
      : (this.props.type === 'mediumDemo'
        ? this.props.classes.spacingMediumDemo
        : this.props.classes.spacing)));
    const spacingStyle = {
      paddingTop: this.props.spacingTop !== undefined ? this.props.spacingTop : this.props.spacingTopBottom,
      paddingBottom: this.props.spacingBottom !== undefined ? this.props.spacingBottom : this.props.spacingTopBottom,
    }

    var content;
    if (this.props.type === 'demoOnly') {
      content = (
        <div
          className={classNames(
            spacingClassname,
            this.props.className,
          )}
          style={spacingStyle}
        >
          {display}
        </div>
      );
    } else {
      var blockVariant;
      var titleVariant = this.props.titleVariant;
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
        case 'headingOnly':
          titleVariant = this.props.titleVariant || 'h4';
          blockVariant = 'headingMain';
          break;
        case 'headingMain':
          blockVariant = 'headingMain';
          break;
      }
      const { classes, ...blockContentProps } = this.props;
      content = (
        <BlockContent
          variant={blockVariant}
          titleVariant={titleVariant}
          {...blockContentProps}
        />
      );

      if (this.props.type === 'headingOnly') {
        content = (
          <div
            className={classNames(
              spacingClassname,
              this.props.className,
            )}
            style={spacingStyle}
          >
            {content}
          </div>
        );
      } else if (this.props.type === 'column') {
        content = (
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
        const isMediumDemo = this.props.type === 'mediumDemo';
        content = (
          <Grid
            className={classNames(
              spacingClassname,
              this.props.className)}
            style={spacingStyle}
            container
            wrap='wrap-reverse'
            direction={!this.props.mirror ? 'row-reverse' : undefined}
            alignItems={this.props.alignItems !== undefined ? this.props.alignItems
              : ((this.props.imagePath || isHero) ? 'center' : 'flex-end')}
            justify='center'
          >
            <Grid
              item
              className={classNames(this.props.classes.grid)}
              alignItems={this.props.displayAlign || 'center'}
              xs={12}
              md={isLargeDemo ? 12 : (isMediumDemo ? 9 : 6)}
              lg={isLargeDemo ? 12 : (isMediumDemo ? 8 : 6)}
              xl={isLargeDemo ? 12 : (isMediumDemo ? 8 : 6)}
            >
              {display}
            </Grid>
            <Grid
              item
              className={this.props.classes.grid}
              alignItems='center'
              xs={12}
              sm={8}
              md={isMediumDemo ? 3 : 6}
              lg={isMediumDemo ? 4 : 5}
              xl={4}
            >
              {!!image && !isLargeDemo && this.props.imageLocation === 'above' && image}
              {content}
            </Grid>
            {!!image && isLargeDemo && this.props.imageLocation === 'above' && (
              <Grid
                item
                className={this.props.classes.grid}
                alignItems='center'
                xs={12}
                sm={8}
                md={6}
                lg={5}
                xl={4}
              >
                {image}
              </Grid>
            )}
          </Grid>
        );
      }
    }

    return content;
  }
}

export default withRouter(withStyles(styles, { withTheme: true })(Block));
