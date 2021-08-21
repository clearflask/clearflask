// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { Paper, withWidth, WithWidthProps } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { initialWidth } from './util/screenUtil';

const styles = (theme: Theme) => createStyles({
  container: {
    position: 'relative',
    width: '100%',
  },
  content: {
    width: '100%',
    boxShadow: '-10px -10px 40px 0 rgba(0,0,0,0.1)',
    overflow: 'hidden',
  },
});

export interface Props {
  items: Array<{
    height?: string | number;
    width?: string | number;
    content: React.ReactNode,
  }>;
  raiseOnHover?: boolean;
  topLeftToBottomRight?: boolean;
  ascendingLevel?: boolean
  contentSpacingHorizontal?: number;
  contentSpacingVertical?: number;
}
interface State {
  hoveringContent?: number;
}
class Stack extends Component<Props & WithStyles<typeof styles, true> & WithWidthProps, State> {
  state: State = {};

  render() {
    const count = this.props.items.length;
    var overlap = true;
    var spacing = 100;
    switch (this.props.width) {
      case "xs":
        overlap = false;
        break;
      case "sm":
        spacing = 150
        break;
      case "md":
        spacing = 50
        break;
      default:
        break;
    }
    var spacingHor = this.props.contentSpacingHorizontal || spacing;
    var spacingVer = this.props.contentSpacingVertical || spacing;

    var marginTopBottom = overlap ? spacingVer * ((count - 1) / 2) : 0;
    var marginLeftRight = overlap ? spacingHor * ((count - 1) / 2) : 0;

    return (
      <div className={this.props.classes.container} style={{
        marginTop: marginTopBottom,
        marginBottom: marginTopBottom,
        marginLeft: marginLeftRight,
        marginRight: marginLeftRight,
        height: overlap ? 300 : undefined,
      }}>
        {this.props.items.map((item, contentNumber) => (
          <Paper
            key={contentNumber}
            className={this.props.classes.content}
            onMouseOver={this.props.raiseOnHover && this.state.hoveringContent !== contentNumber ? () => this.setState({ hoveringContent: contentNumber }) : undefined}
            style={{
              height: item.height || 300,
              width: item.width,
              marginBottom: overlap ? 0 : 40,
              position: overlap ? 'absolute' : 'static',
              left: overlap ? spacingHor * ((count - 1) / 2 - contentNumber) : 0,
              top: overlap ? -spacingVer * ((count - 1) / 2 - contentNumber) * (this.props.topLeftToBottomRight ? -1 : 1) : 0,
              zIndex: this.state.hoveringContent === contentNumber ? 900 : 800 + contentNumber * (this.props.ascendingLevel ? -1 : 1),
            }}
          >
            {item.content}
          </Paper>
        ))}
      </div>
    );
  }
}

export default withStyles(styles, { withTheme: true })(withWidth({ initialWidth })(Stack));
