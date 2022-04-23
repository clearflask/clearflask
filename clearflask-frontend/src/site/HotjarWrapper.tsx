// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { Component } from 'react';
import { hotjar } from 'react-hotjar';
import { trackingBlock } from '../common/util/trackingDelay';

var initializedTrackerCode: number | undefined;

export interface HotjarWrapperProps {
  trackerCode?: number;
}
export default class IntercomWrapper extends Component<HotjarWrapperProps> {

  render() {
    const trackerCode = this.props.trackerCode;
    if (initializedTrackerCode !== trackerCode && trackerCode) {
      trackingBlock(() => {
        try {
          hotjar.initialize(trackerCode, 6);
          initializedTrackerCode = trackerCode;
        } catch (e) { }
      });
    }

    return null;
  }
}
