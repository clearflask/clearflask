// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { Component } from 'react';
import { WithTranslation, withTranslation } from 'react-i18next';
import { SubscriptionStatus } from '../api/admin';
import windowIso from '../common/windowIso';

var loadedToken: string | undefined;
var currentLocale: string | undefined;
var chatwoot: any | undefined;
var identifiedIdentity: string | undefined;

// Docs: https://www.chatwoot.com/docs/product/channels/live-chat/sdk/setup
const loadWidget = (websiteToken: string, callback: (() => void)) => {
  if (windowIso.isSsr) return;
  windowIso.addEventListener('chatwoot:ready', function () {
    chatwoot = windowIso['$chatwoot'];
    callback();
  });
  windowIso['chatwootSettings'] = {
    position: 'right',
    type: 'standard',
    launcherTitle: 'Chat with us',
    showPopoutButton: true,
  };
  (function (d, t) {
    var BASE_URL = 'https://app.chatwoot.com';
    var g: any = d.createElement(t), s: any = d.getElementsByTagName(t)[0];
    g.src = BASE_URL + '/packs/js/sdk.js';
    g.defer = true;
    g.async = true;
    s.parentNode.insertBefore(g, s);
    g.onload = function () {
      windowIso['chatwootSDK'].run({
        websiteToken: websiteToken,
        baseUrl: BASE_URL
      })
    }
  })(document, 'script');
};
const identifyUser = (chatwootToken: string, name: string, email: string) => {
  chatwoot?.setUser?.(email, {
    email,
    name,
    identifier_hash: chatwootToken,
  });
  chatwoot?.setCustomAttributes?.({
    accountId: 1,
    pricingPlan: "paid",
  });
};
const resetUser = () => {
  chatwoot?.reset?.();
};
const setLocale = (locale: string) => {
  chatwoot?.setLocale?.(locale);
};
const disableWidget = () => {
  chatwoot?.toggleBubbleVisibility?.('hide');
};


export interface ChatwootWrapperConnectProps {
  dontUseThisComponentDirectly: true; // Use ChatwootWrapperMain or ChatwootWrapperCustomer
  callOnMount?: () => void,
  disabled?: boolean;
  websiteToken?: string;
  userData?: {
    identity: string;
    email: string;
    name: string;
    basePlanId: string;
    subscriptionStatus: SubscriptionStatus;
  };
}
class ChatwootWrapper extends Component<ChatwootWrapperConnectProps & WithTranslation<'site'>> {
  private mounted = false;

  constructor(props) {
    super(props);

    this.props.callOnMount?.();

    if (!loadedToken && this.props.websiteToken) {
      loadedToken = this.props.websiteToken;
      loadWidget(this.props.websiteToken, () => {
        if (this.mounted) {
          this.forceUpdate();
        }
      });
    }
  }

  componentDidMount() {
    this.mounted = true;
  }

  componentWillUnmount() {
    this.mounted = false;
  }

  render() {
    if (this.props.websiteToken && loadedToken && this.props.websiteToken !== loadedToken) {
      // mismatch of app id, some other instance must be managing intercom
      return null;
    }
    if (this.props.disabled) {
      if (loadedToken) {
        disableWidget();
        loadedToken = undefined;
      }
      return null;
    }
    if (!this.props.websiteToken) {
      return null;
    }
    if (!loadedToken) {
      loadWidget(this.props.websiteToken, () => {
        if (this.mounted) {
          this.forceUpdate();
        }
      });
      loadedToken = this.props.websiteToken;
    }

    if (!!this.props.i18n.language && currentLocale !== this.props.i18n.language) {
      currentLocale = this.props.i18n.language;
      setLocale(this.props.i18n.language);
    }

    const currentIdentity = this.props.userData?.identity;
    if (identifiedIdentity !== currentIdentity) {
      identifiedIdentity = currentIdentity;
      if (!!this.props.userData) {
        identifyUser(
          this.props.userData.identity,
          this.props.userData.name,
          this.props.userData.email);
      } else {
        resetUser();
      }
    }

    return null;
  }
}

export default withTranslation('site', { withRef: true })(ChatwootWrapper);