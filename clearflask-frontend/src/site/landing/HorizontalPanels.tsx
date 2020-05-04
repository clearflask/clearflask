import { Container, isWidthUp, withWidth, WithWidthProps } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import { Breakpoint } from '@material-ui/core/styles/createBreakpoints';
import React, { Component } from 'react';

const styles = (theme: Theme) => createStyles({
  container: {
    display: 'flex',
  },
  content: {
    display: 'flex',
    flex: '1 1 auto',
    padding: theme.spacing(4),
  },
  contentFirst: {
    justifyContent: 'flex-start',
    alignSelf: 'flex-start',
  },
  contentMiddle: {
    justifyContent: 'center',
    alignSelf: 'center',
  },
  contentLast: {
    justifyContent: 'flex-end',
    alignSelf: 'flex-end',
  },
});
interface Props {
  wrapBelow: Breakpoint;
  maxContentWidth?: Breakpoint;
  maxWidth?: Breakpoint;
  staggerMinHeight?: number | string;
}
class HorizontalPanels extends Component<Props & WithStyles<typeof styles, true> & WithWidthProps> {

  render() {
    const isHorizontal = !this.props.width || isWidthUp(this.props.wrapBelow, this.props.width);
    const contentsSize = React.Children.count(this.props.children);
    return (
      <Container
        className={this.props.classes.container}
        maxWidth={this.props.maxWidth}
        style={{
          flexDirection: isHorizontal ? 'row' : 'column',
          minHeight: isHorizontal ? this.props.staggerMinHeight : undefined,
        }}
      >
        {React.Children.map(this.props.children, (content, index) => {
          var contentClass;
          if (index === 0) {
            contentClass = this.props.classes.contentFirst;
          } else if (index === contentsSize - 1) {
            contentClass = this.props.classes.contentLast;
          } else {
            contentClass = this.props.classes.contentMiddle;
          }
          return (
            <div
              key={content?.['key'] || index}
              className={`${this.props.classes.content} ${contentClass}`}
            >
              <Container maxWidth={this.props.maxContentWidth} style={{
                margin: 'unset',
              }}>
                {content}
              </Container>
            </div>
          )
        })}
      </Container>
    );
  }
}

export default withStyles(styles, { withTheme: true })(withWidth()(HorizontalPanels));
