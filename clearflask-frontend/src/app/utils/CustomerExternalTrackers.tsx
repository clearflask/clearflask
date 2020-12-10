import React, { Component } from 'react';
import ReactGA from 'react-ga';
import { connect } from 'react-redux';
import { Route } from 'react-router';
import * as Client from '../../api/client';
import { ReduxState } from '../../api/server';
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
      <React.Fragment>
        <HotjarWrapperCustomer />
        {this.props.googleAnalytics && (
          <Route path='/' render={({ location }) => {
            ReactGA.ga(`${CustomerTrackerName}.set`, 'page', location.pathname + location.search);
            ReactGA.ga(`${CustomerTrackerName}.send`, 'pageview', { 'page': location.pathname + location.search });
            return null;
          }} />
        )}
      </React.Fragment>
    );
  }

  gaInitialize(trackingCode: string) {
    ReactGA.ga('create', trackingCode, 'auto', { 'name': CustomerTrackerName });
    ReactGA.ga(`${CustomerTrackerName}.set`, 'anonymizeIp', true);
    ReactGA.ga(`${CustomerTrackerName}.set`, 'forceSSL', true);

    ReactGA.ga(`${CustomerTrackerName}.send`, 'pageview', { 'page': window.location.pathname + window.location.search });
  }
}


export default connect<ConnectProps, {}, {}, ReduxState>((state: ReduxState) => {
  return {
    googleAnalytics: state.conf.conf?.integrations.googleAnalytics,
    hotjar: state.conf.conf?.integrations.hotjar,
    intercom: state.conf.conf?.integrations.intercom,
  };
})(CustomerExternalTrackers);
