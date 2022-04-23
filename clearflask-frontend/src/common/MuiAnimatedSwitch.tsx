// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { Switch } from 'react-router';

const styles = (theme: Theme) => createStyles({
  switch: {
    flexGrow: 1,
    display: 'flex',
    flexDirection: 'column',
  },
});

interface Props extends WithStyles<typeof styles, true> {
  classes; // Conflicted property
}

class MuiAnimatedSwitch extends Component<Props> {
  render() {
    return (
      <Switch>
        {this.props.children}
      </Switch>
    );
    // TODO Animated switch causes issues with ScrollAnchor and generally is not as nice as I thought before. Either revisit or delete
    // return (
    //   <AnimatedSwitch
    //     className={this.props.classes.switch}
    //     // props https://maisano.github.io/react-router-transition/animated-switch/props
    //     atEnter={{
    //       opacity: 0,
    //       offset: -25,
    //     }}
    //     atLeave={{
    //       opacity: muiSpring(-1),
    //       offset: muiSpring(25),
    //     }}
    //     atActive={{
    //       opacity: muiSpring(1),
    //       offset: muiSpring(0),
    //     }}
    //     mapStyles={(styles) => {
    //       return {
    //         width: '100%',
    //         height: '100%',
    //         position: styles.opacity >= 0.5 ? 'relative' : 'absolute',
    //         opacity: styles.opacity,
    //         transform: `translateY(${styles.offset}px)`,
    //         flexGrow: 1,
    //         display: 'flex',
    //         flexDirection: 'column',
    //       }
    //     }}
    //     runOnMount
    //   >
    //     {this.props.children}
    //   </AnimatedSwitch>
    // );
  }
}

export default withStyles(styles, { withTheme: true })(MuiAnimatedSwitch);
