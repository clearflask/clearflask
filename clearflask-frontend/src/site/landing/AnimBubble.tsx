// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import windowIso from '../../common/windowIso';

const styles = (theme: Theme) => createStyles({
  bubble: {
    position: 'absolute',
    borderRadius: '50%',
  },
});
interface Props {
  size: string | number;
  x?: string | number;
  y?: string | number;
  delay?: string;
  duration?: string;
  timingFunction?: string;
  background?: string;
}
class BubbleAnim extends Component<Props & WithStyles<typeof styles, true>> {
  init: boolean = true;
  task: NodeJS.Timeout | undefined = undefined;

  componentDidMount() {
    if (!windowIso.isSsr && this.init) {
      this.init = false;
      this.task = setTimeout(() => this.forceUpdate(), 1);
    }
  }

  componentWillUnmount() {
    this.task && clearTimeout(this.task);
  }

  render() {
    const color = this.props.theme.palette.secondary.main;
    const size = this.init
      ? '0px'
      : (typeof this.props.size === 'number'
        ? `${this.props.size}px`
        : this.props.size);
    const x = typeof this.props.x === 'number'
      ? `${this.props.x}px`
      : this.props.x
    const y = typeof this.props.y === 'number'
      ? `${this.props.y}px`
      : this.props.y
    const timingFunction = this.props.timingFunction || 'cubic-bezier(0.2, 1.08, 1, 0.99)';
    const duration = this.props.duration || '1s';
    return (
      <div
        className={this.props.classes.bubble}
        style={{
          width: size,
          height: size,
          top: `calc(${y || '0px'} - ${size} / 2)`,
          left: `calc(${x || '0px'} - ${size} / 2)`,
          backgroundImage: this.props.background || `radial-gradient(circle, ${color} 50%, ${color} 100%)`,
          transition: `width ${duration} ${timingFunction},`
            + `height ${duration} ${timingFunction},`
            + `top ${duration} ${timingFunction},`
            + `left ${duration} ${timingFunction}`,
          transitionDelay: this.props.delay || '0s',
        }}
      >&nbsp;</div>
    );
  }
}

export default withStyles(styles, { withTheme: true })(BubbleAnim);
