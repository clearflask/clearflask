import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
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
          className={this.props.className}
          title={this.props.title}
          width={this.props.direction === Direction.Vertical ? '90%' : undefined}
          maxWidth={this.props.direction === Direction.Vertical ? 300 : undefined}
          height={this.props.direction === Direction.Horizontal ? '90%' : undefined}
          maxHeight={this.props.direction === Direction.Horizontal ? 300 : undefined}
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

export default withStyles(styles, { withTheme: true })(Panel);
