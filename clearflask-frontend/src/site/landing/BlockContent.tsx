// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { Button, ButtonProps, SvgIconTypeMap, Typography } from '@material-ui/core';
import { OverridableComponent } from '@material-ui/core/OverridableComponent';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import GoIcon from '@material-ui/icons/ArrowRightAlt';
import CheckIcon from '@material-ui/icons/Check';
import XIcon from '@material-ui/icons/Close';
import classNames from 'classnames';
import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import PostStatusIframe from '../../app/PostStatusIframe';
import ScrollAnchor, { Props as ScrollAnchorProps } from '../../common/util/ScrollAnchor';

export type Point = string | {
  text: React.ReactNode;
  icon?: OverridableComponent<SvgIconTypeMap> | Array<OverridableComponent<SvgIconTypeMap>>;
}

const styles = (theme: Theme) => createStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
  },
  description: {
    marginTop: theme.spacing(2),
    color: theme.palette.text.secondary,
  },
  button: {
    alignSelf: 'flex-end',
  },
  buttonFilled: {
    marginTop: theme.spacing(2),
  },
  marker: {
    color: theme.palette.text.secondary,
  },
  titleColorSecondary: {
    color: theme.palette.text.secondary,
  },
  points: {
    margin: theme.spacing(1, 0),
  },
  point: {
    display: 'flex',
    alignItems: 'center',
    margin: theme.spacing(1),
    color: theme.palette.text.secondary,
  },
  pointIcon: {
    color: theme.palette.primary.main,
    marginRight: theme.spacing(1),
  },
  counterpointIcon: {
    color: theme.palette.error.dark,
  },
  iconTitleContainer: {
    display: 'flex',
    columnGap: theme.spacing(2),
    rowGap: theme.spacing(2),
  },
  iconTitleContainerRow: {
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  iconTitleContainerColumn: {
    alignItems: 'flex-start',
    flexDirection: 'column',
  },
  buttonsContainer: {
    display: 'flex',
    alignSelf: 'flex-end',
    margin: theme.spacing(4, 8),
    [theme.breakpoints.down('xs')]: {
      margin: theme.spacing(4, 4),
    },
  },
  button2: {
    marginRight: theme.spacing(2),
  },
});

export interface Props {
  className?: string;
  title?: string | React.ReactNode;
  titleColorSecondary?: boolean;
  subtitle?: string | React.ReactNode;
  marker?: string;
  description?: string | React.ReactNode;
  points?: Array<Point>;
  largePoints?: boolean;
  xlargePoints?: boolean;
  counterpoints?: Array<string>;
  postStatusId?: string;
  buttonIcon?: React.ReactNode;
  buttonTitle?: string;
  buttonVariant?: ButtonProps['variant'];
  buttonLinkExt?: string;
  buttonLink?: string;
  buttonState?: any;
  buttonSuppressIcon?: boolean;
  buttonOnClick?: () => void;
  button2Title?: string;
  button2Link?: string;
  variant?: 'hero' | 'headingMain' | 'heading' | 'content';
  titleVariant?: React.ComponentProps<typeof Typography>['variant'];
  titleCmpt?: string;
  subtitleVariant?: React.ComponentProps<typeof Typography>['variant'];
  icon?: React.ReactNode;
  iconAbove?: boolean;
  scrollAnchor?: ScrollAnchorProps;
}
class BlockContent extends Component<Props & WithStyles<typeof styles, true>> {

  render() {
    var titleVariant;
    var bodyVariant;
    var titleCmpt;
    var bodyCmpt;
    switch (this.props.variant) {
      case 'hero':
        titleVariant = this.props.titleVariant || 'h2';
        bodyVariant = 'h5';
        titleCmpt = this.props.titleCmpt || 'h1';
        bodyCmpt = 'div';
        break;
      case 'headingMain':
        titleVariant = this.props.titleVariant || 'h3';
        bodyVariant = 'body1';
        titleCmpt = this.props.titleCmpt || 'h2';
        bodyCmpt = 'div';
        break;
      case 'heading':
        titleVariant = this.props.titleVariant || 'h4';
        bodyVariant = 'body1';
        titleCmpt = this.props.titleCmpt || 'h3';
        bodyCmpt = 'div';
        break;
      default:
      case 'content':
        titleVariant = this.props.titleVariant || 'h5';
        bodyVariant = 'body1';
        titleCmpt = this.props.titleCmpt || 'h4';
        bodyCmpt = 'div';
        break;
    }
    const pointVariant = this.props.xlargePoints ? 'h4' : (this.props.largePoints ? 'h6' : bodyVariant);
    const counterpoints = this.props.counterpoints?.map(text => {
      return (
        <Typography variant={pointVariant} component='div' className={this.props.classes.point}>
          <XIcon color='inherit' fontSize='inherit' className={classNames(this.props.classes.pointIcon, this.props.classes.counterpointIcon)} />
          {text}
        </Typography>
      );
    });
    return (
      <div className={classNames(this.props.classes.container, this.props.className)}>
        <Typography variant={titleVariant} component={titleCmpt} className={classNames(this.props.titleColorSecondary && this.props.classes.titleColorSecondary)}>
          {this.props.icon ? (
            <div className={classNames(
              this.props.classes.iconTitleContainer,
              this.props.iconAbove ? this.props.classes.iconTitleContainerColumn : this.props.classes.iconTitleContainerRow,
            )}>
              {this.props.icon}
              {this.props.title}
            </div>
          ) : this.props.title}
        </Typography>
        {!!this.props.subtitle && (
          <Typography variant={this.props.subtitleVariant || 'subtitle1'} component='div'>
            {this.props.subtitle}
          </Typography>
        )}
        {this.props.marker && (
          <Typography variant='caption' className={this.props.classes.marker}>{this.props.marker}</Typography>
        )}
        {!!this.props.scrollAnchor && (
          <ScrollAnchor {...this.props.scrollAnchor} />
        )}
        <Typography variant={bodyVariant} component={bodyCmpt} className={this.props.classes.description}>{this.props.description}</Typography>
        {!!this.props.points && (
          <div className={this.props.classes.points}>
            {this.props.points.map(point => {
              const text = typeof point === 'string' ? point : point.text;
              const icons = (typeof point === 'string' || !point.icon) ? [CheckIcon] : (Array.isArray(point.icon)
                ? point.icon : [point.icon]);
              return (
                <Typography variant={pointVariant} component='div' className={this.props.classes.point}>
                  {icons.map(Icon => (
                    <Icon color='inherit' fontSize='inherit' className={classNames(this.props.classes.pointIcon)} />
                  ))}
                  {text}
                </Typography>
              );
            })}
            {counterpoints}
          </div>
        )}
        {(!this.props.points && counterpoints) && (
          <div className={this.props.classes.points}>
            {counterpoints}
          </div>
        )}
        {this.props.postStatusId && (
          <PostStatusIframe
            className={this.props.classes.button}
            postId={this.props.postStatusId}
            config={{
              fontSize: '1.1em',
              alignItems: 'end',
              justifyContent: 'end',
            }}
          />
        )}
        {(this.props.buttonTitle || this.props.button2Title) && (
          <div className={this.props.classes.buttonsContainer}>
            {!!this.props.button2Title && (
              <Button
                variant='outlined'
                className={this.props.classes.button2}
                {...(this.props.button2Link ? {
                  component: Link,
                  to: this.props.button2Link,
                } : {})}
              >
                {this.props.button2Title}
              </Button>
            )}
            {this.props.buttonTitle && (
              <Button
                className={classNames(
                  this.props.classes.button,
                  ((this.props.buttonVariant || 'text') !== 'text') && this.props.classes.buttonFilled,
                )}
                variant={this.props.buttonVariant || (this.props.button2Title ? 'contained' : 'text')}
                disableElevation
                color='primary'
                onClick={this.props.buttonOnClick ? (() => {
                  this.props.buttonOnClick?.();
                }) : undefined}
                {...(this.props.buttonLink ? {
                  component: Link,
                  to: {
                    pathname: this.props.buttonLink,
                    state: this.props.buttonState,
                  },
                } : {})}
                {...(this.props.buttonLinkExt ? {
                  component: 'a',
                  href: this.props.buttonLinkExt,
                } : {})}
              >
                {this.props.buttonIcon && (
                  <>
                    {this.props.buttonIcon}
                    &nbsp;&nbsp;&nbsp;
                  </>
                )}
                {this.props.buttonTitle}
                {!this.props.buttonSuppressIcon && !this.props.buttonIcon && (
                  <>
                    &nbsp;
                    <GoIcon />
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }
}

export default withStyles(styles, { withTheme: true })(BlockContent);
