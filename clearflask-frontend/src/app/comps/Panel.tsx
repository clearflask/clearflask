// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { Fade, IconButton, Typography } from '@material-ui/core';
import { createStyles, Theme, useTheme, withStyles, WithStyles } from '@material-ui/core/styles';
import classNames from 'classnames';
import React, { Component } from 'react';
import { contentScrollApplyStyles, Orientation, Side } from '../../common/ContentScroll';
import DividerCorner from '../utils/DividerCorner';

export enum Direction {
  Horizontal,
  Vertical,
}

const styles = (theme: Theme) => createStyles({
  container: {
    display: 'flex',
    maxWidth: 'min-content',
  },
  [Direction.Horizontal]: {
    alignItems: 'baseline',
    ...contentScrollApplyStyles({ theme, side: Side.Center, orientation: Orientation.Horizontal }),
  },
  [Direction.Vertical]: {
    flexDirection: 'column',
    alignItems: 'stretch',
    minWidth: 300,
    ...contentScrollApplyStyles({ theme, side: Side.Center, orientation: Orientation.Vertical }),
  },
  cornerlessHorizontal: {
    height: '90%',
    maxHeight: 300,
  },
  cornerlessVertical: {
    width: '90%',
    maxWidth: 300,
  },
});

interface Props {
  className?: string;
  direction: Direction;
  title?: React.ReactNode;
  maxHeight?: string | number,
}
class Panel extends Component<Props & WithStyles<typeof styles, true>> {
  render() {
    var content = (
      <div
        className={classNames(!this.props.title && this.props.className, this.props.classes.container, this.props.classes[this.props.direction])}
        style={{ maxHeight: this.props.maxHeight }}
      >
        {this.props.children}
      </div>
    );

    if (this.props.title) {
      content = (
        <DividerCorner
          suppressDivider
          className={this.props.className}
          title={this.props.title}
        >
          {content}
        </DividerCorner>
      );
    } else {
      content = (
        <div className={this.props.direction === Direction.Horizontal
          ? this.props.classes.cornerlessHorizontal : this.props.classes.cornerlessVertical}>
          {content}
        </div>
      );
    }

    return content;
  }
}

export const PanelTitle = (props: {
  className?: string;
  text?: React.ReactNode;
  color?: string;
  iconAction?: {
    icon: React.ReactNode;
    onClick: () => void;
    transparent?: boolean;
  };
} & Omit<Partial<React.ComponentPropsWithoutRef<typeof Typography>>, 'color'>) => {
  const { text, color, ...TypographyProps } = props;
  const theme = useTheme();
  if (!props.text) return null;

  var iconAction;
  if (props.iconAction) {
    iconAction = (
      <IconButton onClick={props.iconAction.onClick}>
        {props.iconAction.icon}
      </IconButton>
    );
    if (props.iconAction.transparent !== undefined) {
      iconAction = (
        <Fade in={!props.iconAction.transparent}>
          {iconAction}
        </Fade>
      );
    }
  }

  return (
    <Typography
      className={props.className}
      variant='h4'
      component='div'
      style={{ color: color !== undefined ? color : theme.palette.text.secondary }}
      {...TypographyProps}
    >
      {text}
      {iconAction}
    </Typography>
  );
}

export default withStyles(styles, { withTheme: true })(Panel);
