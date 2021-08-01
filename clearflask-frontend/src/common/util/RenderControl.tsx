// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
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
