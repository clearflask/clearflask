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
}
class HorizontalPanels extends Component<Props & WithStyles<typeof styles, true> & WithWidthProps> {

  render() {
    const isHorizontal = this.props.alwaysWrap ? false : (!this.props.width || !this.props.wrapBelow || isWidthUp(this.props.wrapBelow, this.props.width));
    const contentsSize = React.Children.count(this.props.children);

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
        {React.Children.map(this.props.children, (content, index) => {
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
