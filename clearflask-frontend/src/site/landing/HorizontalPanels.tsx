// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { Container, isWidthUp, withWidth, WithWidthProps } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import { Breakpoint } from '@material-ui/core/styles/createBreakpoints';
import React, { Component } from 'react';
import { initialWidth } from '../../common/util/screenUtil';

const styles = (theme: Theme) => createStyles({
  container: {
    display: 'flex',
  },
  content: {
    display: 'flex',
    flex: '1 1 0px',
    padding: theme.spacing(4),
    justifyContent: 'space-between',
  },
});
interface Props {
  alwaysWrap?: boolean;
  wrapBelow?: Breakpoint;
  maxContentWidth?: Breakpoint;
  maxWidth?: Breakpoint;
  staggerHeight?: number;
  padLeft?: number;
  padRight?: number;
}
class HorizontalPanels extends Component<Props & WithStyles<typeof styles, true> & WithWidthProps> {

  render() {
    const isHorizontal = this.props.alwaysWrap ? false : (!this.props.width || !this.props.wrapBelow || isWidthUp(this.props.wrapBelow, this.props.width));
    const padLeftSize = isHorizontal && this.props.padLeft || 0;
    const padRightSize = isHorizontal && this.props.padRight || 0;
    const childrenSize = React.Children.count(this.props.children)
    const contentsSize = childrenSize + padLeftSize + padRightSize;
    const childrenMapper: (mapper: (content: React.ReactNode, index: number) => React.ReactNode) => React.ReactNode = (mapper) => {
      return (
        <>
          {isHorizontal ? [...Array(padLeftSize)].map((c, i) => mapper((<div />), i)) : null}
          {React.Children.map(this.props.children, (c, i) => mapper(c, (isHorizontal ? padLeftSize : 0) + i))}
          {isHorizontal ? [...Array(padRightSize)].map((c, i) => mapper((<div />), padLeftSize + childrenSize + i)) : undefined}
        </>
      );
    }

    const staggerHeight = Math.abs(this.props.staggerHeight || 0);
    const staggerAsc = (this.props.staggerHeight || 0) < 0;
    const childrenCount = React.Children.count(this.props.children);
    return (
      <Container
        className={this.props.classes.container}
        maxWidth={this.props.maxWidth}
        style={{
          flexDirection: isHorizontal ? 'row' : (staggerAsc ? 'column-reverse' : 'column'),
        }}
      >
        {childrenMapper((content, index) => {
          if (!content) return null;
          var leftPads = index;
          var rightPads = contentsSize - index - 1;
          return (
            <div
              key={content?.['key'] || index}
              className={this.props.classes.content}
              style={isHorizontal ? {
                marginTop: staggerAsc
                  ? (childrenCount - index - 1) * staggerHeight
                  : index * staggerHeight
              } : undefined}
            >
              {[...Array(leftPads)].map((u, i) => (<div key={`left-${i}`} />))}
              <Container maxWidth={this.props.maxContentWidth} style={{
                margin: 'unset',
              }}>
                {content}
              </Container>
              {[...Array(rightPads)].map((u, i) => (<div key={`right-${i}`} />))}
            </div>
          )
        }) || {}}
      </Container>
    );
  }
}

export default withStyles(styles, { withTheme: true })(withWidth({ initialWidth })(HorizontalPanels));
