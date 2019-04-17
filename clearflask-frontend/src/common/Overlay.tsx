import React, { Component } from 'react';
import Trigger from 'rc-trigger';

interface Props {
  popup: React.ReactNode;
  children: React.ReactNode;
  isInsideMuiTable?: boolean;
}

interface State {
  clickOpened:boolean;
  childFocused:boolean;
}

export default class Overlay extends Component<Props, State> {
  ignoreNextClickOpened:boolean = false;

  constructor(props) {
    super(props)
    this.state = {
      clickOpened: false,
      childFocused: false,
    };
  }

  render() {
    return (
      <Trigger
        action={['click']}
        forceRender
        mouseLeaveDelay={0}
        destroyPopupOnHide
        popupVisible={this.state.clickOpened || this.state.childFocused}
        onPopupVisibleChange={open => {
          if(this.ignoreNextClickOpened) {
            this.ignoreNextClickOpened = false;
            return;
          }
          if(open && !this.state.childFocused) return;
          this.setState({clickOpened: open})
        }}
        popup={this.props.popup}
        popupAlign={{
          points: ['tl', 'bl'],
          offset: [0, 10]
        }}
      >
        <div
          onFocus={e => {
            // MUI table has a bug where onClick events are not fired properly
            // It causes rc-trigger to fire a close immediately, let's ignore it.
            // https://github.com/mui-org/material-ui/issues/1783
            if(this.props.isInsideMuiTable) this.ignoreNextClickOpened = true;
            this.setState({childFocused: true, clickOpened: true})
          }}
          onBlur={e => this.setState({childFocused: false})}
        >
          {this.props.children}
        </div>
      </Trigger>
    );
  }
}
