// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { SvgIconTypeMap, Typography } from '@material-ui/core';
import { OverridableComponent } from '@material-ui/core/OverridableComponent';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import classNames from 'classnames';
import React, { Component } from 'react';
import { BoxLayoutBoxApplyStyles } from '../../common/Layout';
import { contentScrollApplyStyles, Orientation } from '../../common/ContentScroll';

const styles = (theme: Theme) => createStyles({
  containerBox: {
    ...BoxLayoutBoxApplyStyles(theme),
  },
  container: {
    display: 'inline-grid',
    gridTemplateColumns: 'auto 1fr',
    gridTemplateRows: 'auto 1fr',
    gridTemplateAreas:
      '\'t t\''
      + ' \'v c\'',
    gap: theme.spacing(2, 2),
    padding: theme.spacing(2),
    margin: theme.spacing(2),
    position: 'relative', // for chartAsBackground
  },
  scroll: {
    ...contentScrollApplyStyles({ theme, orientation: Orientation.Vertical }),
  },
  chart: {
    gridArea: 'c',
    alignSelf: 'center',
  },
  chartPlaceholder: {
    gridArea: 'c',
    height: 'inherit',
  },
  chartAsBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  value: {
    gridArea: 'v',
    fontSize: '3em',
    alignSelf: 'center',
    minWidth: 80,
    textAlign: 'center',
  },
  title: {
    gridArea: 't',
    fontSize: '1.3em',
    display: 'flex',
    alignItems: 'center',
    zIndex: 1,
  },
  icon: {
    marginRight: theme.spacing(2),
  },
});

interface Props {
  className?: string;
  scroll?: boolean;
  icon?: OverridableComponent<SvgIconTypeMap>;
  title?: React.ReactNode;
  value?: React.ReactNode;
  chart?: React.ReactNode;
  chartAsBackground?: {
    width: number | string,
    height: number | string,
  };
}

class DashboardHomeBox extends Component<Props & WithStyles<typeof styles, true>> {

  render() {
    const Icon = this.props.icon || null;
    return (
      <div
        className={classNames(
          !!this.props.scroll && this.props.classes.scroll,
          this.props.classes.container,
          !this.props.chartAsBackground && this.props.classes.containerBox,
          this.props.className,
        )}
        style={this.props.chartAsBackground ? {
          width: this.props.chartAsBackground.width,
          height: this.props.chartAsBackground.height,
        } : undefined}
      >
        {this.props.title !== undefined && (
          <Typography
            className={this.props.classes.title}
            component="div">
            {!!Icon && (
              <Icon
                className={this.props.classes.icon}
                fontSize="inherit"
                color="inherit"
              />
            )}
            {this.props.title}
          </Typography>
        )}
        {this.props.value !== undefined && (
          <Typography
            className={this.props.classes.value}
            component="div">
            {this.props.value}
          </Typography>
        )}
        {!this.props.chartAsBackground ? (
          <div className={this.props.classes.chart}>
            {this.props.chart}
          </div>
        ) : (
          <>
            <div className={this.props.classes.chartPlaceholder} />
            <div className={this.props.classes.chartAsBackground}>
              {this.props.chart}
            </div>
          </>
        )}
      </div>
    );
  }
}

export default withStyles(styles, { withTheme: true })(DashboardHomeBox);
