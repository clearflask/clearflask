import React, { Component, Key } from 'react';
import { withStyles, Theme, createStyles, WithStyles } from '@material-ui/core/styles';
import { AnimatedSwitch } from 'react-router-transition';
import muiSpring from './muiSpring';

const styles = (theme:Theme) => createStyles({
  switch: {
    position: 'relative', // Required for absolutely positioned children
  },
});

interface Props extends WithStyles<typeof styles, true> {
  classes; // Conflicted property
}

class MuiAnimatedSwitch extends Component<Props> {
  render() {
    return (
      <AnimatedSwitch
        // props https://maisano.github.io/react-router-transition/animated-switch/props
        atEnter={{
          opacity: 0,
          offset: -25,
        }}
        atLeave={{
          opacity: muiSpring(-1),
          offset: muiSpring(25),
        }}
        atActive={{
          opacity: muiSpring(1),
          offset: muiSpring(0),
        }}
        mapStyles={(styles) => {return {
          width: '100%',
          position: styles.opacity >= 0.999 ? 'relative' : 'absolute',
          opacity: styles.opacity,
          transform: `translateY(${styles.offset}px)`
        }}}
        runOnMount
      >
        {this.props.children}
      </AnimatedSwitch>
    );
  }
}

export default withStyles(styles, { withTheme: true })(MuiAnimatedSwitch);
