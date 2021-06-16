import { Component } from 'react';

export interface Props {
  freezeInitialRender?: boolean;
  children?: any;
}
class RenderControl extends Component<Props> {
  hasRendered: boolean = false;

  render() {
    if (!this.hasRendered) {
      if (this.props.freezeInitialRender) {
        return null;
      } else {
        this.hasRendered = true;
      }
    }
    return this.props.children;
  }
}

export default RenderControl;
