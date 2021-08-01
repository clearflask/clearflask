// SPDX-FileCopyrightText: 2019-2020 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { Component } from 'react';
import { hotjar } from 'react-hotjar';

var initializedTrackerCode: number | undefined;

export interface HotjarWrapperProps {
  trackerCode?: number;
}
export default class IntercomWrapper extends Component<HotjarWrapperProps> {

  render() {
    if (initializedTrackerCode !== this.props.trackerCode && this.props.trackerCode) {
      try {
        hotjar.initialize(this.props.trackerCode, 6);
        initializedTrackerCode = this.props.trackerCode;
      } catch (e) { }
    }

    return null;
  }
}
