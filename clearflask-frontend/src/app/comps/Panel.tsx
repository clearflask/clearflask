import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import classNames from 'classnames';
import React, { Component } from 'react';
import { contentScrollApplyStyles, Side } from '../../common/ContentScroll';
import DividerCorner from '../utils/DividerCorner';

export enum Direction {
  Horizontal,
  Vertical,
}

const styles = (theme: Theme) => createStyles({
  container: {
    display: 'flex',
    alignItems: 'baseline',
  },
  [Direction.Horizontal]: {
    ...(contentScrollApplyStyles(theme, Side.Center, false)),
  },
  [Direction.Vertical]: {
    flexDirection: 'column',
    ...(contentScrollApplyStyles(theme, Side.Center, true)),
  },
});

interface Props {
  className?: string;
  innerClassName?: string;
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
          innerClassName={this.props.innerClassName}
          title={this.props.title}
          width={this.props.direction === Direction.Vertical ? '90%' : undefined}
          maxWidth={this.props.direction === Direction.Vertical ? 300 : undefined}
          height={this.props.direction === Direction.Horizontal ? '90%' : undefined}
          maxHeight={this.props.direction === Direction.Horizontal ? 300 : undefined}
        >
          {content}
        </DividerCorner>
      );
    }

    return content;
  }
}

export default withStyles(styles, { withTheme: true })(Panel);
