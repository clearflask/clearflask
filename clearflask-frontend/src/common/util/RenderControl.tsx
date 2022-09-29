// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
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
