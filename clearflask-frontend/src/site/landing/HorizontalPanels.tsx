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
    justifyContent: 'center',
  },
});
interface Props {
  wrapBelow: Breakpoint;
  maxContentWidth?: Breakpoint;
  maxWidth?: Breakpoint;
  staggerHeight?: number;
}
class HorizontalPanels extends Component<Props & WithStyles<typeof styles, true> & WithWidthProps> {

  render() {
    const isHorizontal = !this.props.width || isWidthUp(this.props.wrapBelow, this.props.width);
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
          return (
            <div
              key={content?.['key'] || index}
              className={this.props.classes.content}
              style={isHorizontal ? {
                marginTop: staggerAsc
                  ? (childrenCount - index) * staggerHeight
                  : index * staggerHeight
              } : undefined}
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
