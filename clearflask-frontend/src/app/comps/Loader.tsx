import React, { Component } from 'react';
import { Fade, Grow, Slide, Zoom } from '@material-ui/core';
import { withStyles, Theme, createStyles, WithStyles } from '@material-ui/core/styles';
import Loading from './Loading';
import * as Client from '../../api/client';
import { connect } from 'react-redux';
import { ReduxState } from '../../api/server';

const styles = (theme:Theme) => createStyles({
  container: {
    margin: theme.spacing.unit,
    display: 'flex',
  },
  content: {
  },
});

interface Props extends WithStyles<typeof styles> {
  loaded:boolean;
  // connect
  type:Client.AnimationTypeEnum|undefined;
}

class Loader extends Component<Props> {
  render() {
    if(!this.props.loaded) {
      return (<Loading />);
    }
    const wrappedChildren = (
      <div>{this.props.children}</div>
    );
    switch(this.props.type) {
      case Client.AnimationTypeEnum.Fade:
        return (<Fade in={this.props.loaded}>{wrappedChildren}</Fade>);
      case Client.AnimationTypeEnum.Grow:
        return (<Grow in={this.props.loaded}>{wrappedChildren}</Grow>);
      case Client.AnimationTypeEnum.Zoom:
        return (<Zoom in={this.props.loaded}>{wrappedChildren}</Zoom>);
      case Client.AnimationTypeEnum.Slide:
        return (<Slide direction='left' in={this.props.loaded}>{wrappedChildren}</Slide>);
      default:
      case Client.AnimationTypeEnum.None:
        return this.props.children;
    }
  }
}

export default connect<any,any,any,any>((state:ReduxState, ownProps:Props) => {return {
  type: state.conf.conf && state.conf.conf.style.animation.type
}})(withStyles(styles, { withTheme: true })(Loader));
