// SPDX-FileCopyrightText: 2019-2023 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { Component } from 'react';
import ReactGA from 'react-ga';
import ReactGA4 from 'react-ga4';
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
  gaUaInitialized?: boolean;
  gaV4Initialized?: boolean;

  constructor(props) {
    super(props);

    if (props.googleAnalytics?.trackingCode) {
      this.gaUaInitialize(props.googleAnalytics.trackingCode);
      this.gaUaInitialized = true;
    }


    if (props.googleAnalytics?.trackingCodeV4) {
      this.gaV4Initialize(props.googleAnalytics.trackingCodeV4);
      this.gaV4Initialized = true;
    }
  }

  render() {
    if (this.props.googleAnalytics?.trackingCode && !this.gaUaInitialized) {
      this.gaUaInitialize(this.props.googleAnalytics.trackingCode);
      this.gaUaInitialized = true;
    }
    if (this.props.googleAnalytics?.trackingCodeV4 && !this.gaV4Initialized) {
      this.gaV4Initialize(this.props.googleAnalytics.trackingCodeV4);
      this.gaV4Initialized = true;
    }
    return (
      <>
        <HotjarWrapperCustomer />
        {this.props.googleAnalytics?.trackingCode && (
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

  gaUaInitialize(trackingCode: string) {
    trackingBlock(() => {
      ReactGA.ga('create', trackingCode, 'auto', { 'name': CustomerTrackerName });
      ReactGA.ga(`${CustomerTrackerName}.set`, 'anonymizeIp', true);
      ReactGA.ga(`${CustomerTrackerName}.set`, 'forceSSL', true);

      ReactGA.ga(`${CustomerTrackerName}.send`, 'pageview', { 'page': windowIso.location.pathname + windowIso.location.search });
    });
  }

  gaV4Initialize(trackingCode: string) {
    trackingBlock(() => {
      ReactGA4.initialize(trackingCode, { gaOptions: {'name': CustomerTrackerName }});
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
