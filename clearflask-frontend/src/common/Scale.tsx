// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';

const styles = (theme: Theme) => createStyles({
});

export interface Props {
  scale: number;
  height?: number;
}
class Scale extends Component<Props & WithStyles<typeof styles, true>> {
  // containerRef: React.RefObject<HTMLDivElement> = React.createRef();
  // lastObservedHeight: number | undefined = 0;

  render() {
    // TODO FINISH THIS
    // console.log("DEBUG heights", this.containerRef.current?.offsetHeight, this.containerRef.current?.clientHeight, this.containerRef.current?.scrollHeight, this.containerRef.current?.getBoundingClientRect().height);
    // var newHeight = this.containerRef.current?.getBoundingClientRect().height;
    // console.log("DEBUG new", newHeight);
    // // Very hacky, but let's keep checking if size changes until it stabilizes
    // if (newHeight !== this.lastObservedHeight) {
    //   this.lastObservedHeight = newHeight;
    //   setTimeout(() => this.forceUpdate(), 100)
    // }
    return (
      // <div style={{
      //   marginBottom: !!newHeight
      //     ? - newHeight * (1 - this.props.scale)
      //     : undefined,
      // }}>
      // <div ref={this.containerRef}>
      <div style={{
        transform: `scale(${this.props.scale})`,
        transformOrigin: '0 0',
        width: `${100 / this.props.scale}%`,
        height: this.props.height ? this.props.height * this.props.scale : undefined,
      }}>
        <div style={{
          height: this.props.height ? this.props.height / this.props.scale : undefined,
        }}>
          {this.props.children}
        </div>
      </div>
      // </div>
      // </div>
    );
  }
}

export default withStyles(styles, { withTheme: true })(Scale);
