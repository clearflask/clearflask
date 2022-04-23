// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import React, { Component } from 'react';
import ReactGA from 'react-ga';
import { connect } from 'react-redux';
import { Route } from 'react-router';
import * as Client from '../../api/client';
import { ReduxState } from '../../api/server';
import { trackingBlock } from '../../common/util/trackingDelay';
import windowIso from '../../common/windowIso';
import HotjarWrapperCustomer from '../../site/HotjarWrapperCustomer';

const CustomerTrackerName = 'customerTracker';

interface ConnectProps {
  googleAnalytics?: Client.GoogleAnalytics;
  hotjar?: Client.Hotjar;
  intercom?: Client.Intercom;
}
class CustomerExternalTrackers extends Component<ConnectProps> {
  gaInitialized?: boolean;

  constructor(props) {
    super(props);

    if (props.googleAnalytics) {
      this.gaInitialize(props.googleAnalytics.trackingCode);
      this.gaInitialized = true;
    }

  }

  render() {
    if (this.props.googleAnalytics && !this.gaInitialized) {
      this.gaInitialize(this.props.googleAnalytics.trackingCode);
      this.gaInitialized = true;
    }
    return (
      <>
        <HotjarWrapperCustomer />
        {this.props.googleAnalytics && (
          <Route path='/' render={routeProps => {
            trackingBlock(() => {
              ReactGA.ga(`${CustomerTrackerName}.set`, 'page', routeProps.location.pathname + routeProps.location.search);
              ReactGA.ga(`${CustomerTrackerName}.send`, 'pageview', { 'page': routeProps.location.pathname + routeProps.location.search });
            });
            return null;
          }} />
        )}
      </>
    );
  }

  gaInitialize(trackingCode: string) {
    trackingBlock(() => {
      ReactGA.ga('create', trackingCode, 'auto', { 'name': CustomerTrackerName });
      ReactGA.ga(`${CustomerTrackerName}.set`, 'anonymizeIp', true);
      ReactGA.ga(`${CustomerTrackerName}.set`, 'forceSSL', true);

      ReactGA.ga(`${CustomerTrackerName}.send`, 'pageview', { 'page': windowIso.location.pathname + windowIso.location.search });
    });
  }
}


export default connect<ConnectProps, {}, {}, ReduxState>((state: ReduxState) => {
  return {
    googleAnalytics: state.conf.conf?.integrations.googleAnalytics,
    hotjar: state.conf.conf?.integrations.hotjar,
    intercom: state.conf.conf?.integrations.intercom,
  };
})(CustomerExternalTrackers);
