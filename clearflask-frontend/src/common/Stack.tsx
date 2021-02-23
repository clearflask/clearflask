import { Paper, withWidth, WithWidthProps } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { initialWidth } from './util/screenUtil';

const styles = (theme: Theme) => createStyles({
  container: {
    position: 'relative',
  },
  content: {
    padding: theme.spacing(2),
    width: '100%',
    boxShadow: '-10px -10px 40px 0 rgba(0,0,0,0.1)',
    overflow: 'auto',
  },
});

export interface Props {
  contents: React.ReactNode[];
  raiseOnHover?: boolean;
  topLeftToBottomRight?: boolean;
  ascendingLevel?: boolean
  contentHeight?: number;
  contentSpacingHorizontal?: number;
  contentSpacingVertical?: number;
}
interface State {
  hoveringContent?: number;
}
class Stack extends Component<Props & WithStyles<typeof styles, true> & WithWidthProps, State> {
  state: State = {};

  render() {
    const count = this.props.contents.length;
    var overlap = true;
    var height = this.props.contentHeight || 300
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

    return (
      <div className={this.props.classes.container} style={{
        margin: overlap ? spacing * (count - 1) / 2 : 0,
        height: overlap ? height : undefined,
      }}>
        {this.props.contents.map((content, contentNumber) => (
          <Paper
            key={contentNumber}
            variant='outlined'
            className={this.props.classes.content}
            onMouseOver={this.props.raiseOnHover && this.state.hoveringContent !== contentNumber ? () => this.setState({ hoveringContent: contentNumber }) : undefined}
            style={{
              height: height,
              marginBottom: overlap ? 0 : 40,
              position: overlap ? 'absolute' : 'static',
              left: overlap ? spacingHor * ((count - 1) / 2 - contentNumber) : 0,
              top: overlap ? -spacingVer * ((count - 1) / 2 - contentNumber) * (this.props.topLeftToBottomRight ? -1 : 1) : 0,
              zIndex: this.state.hoveringContent === contentNumber ? 1100 : 1000 + contentNumber * (this.props.ascendingLevel ? -1 : 1),
            }}
          >
            {content}
          </Paper>
        ))}
      </div>
    );
  }
}

export default withStyles(styles, { withTheme: true })(withWidth({ initialWidth })(Stack));
