// SPDX-FileCopyrightText: 2019-2020 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { Component } from 'react';
import windowIso from '../common/windowIso';

var initializedToken: string | undefined;

export interface HotjarWrapperProps {
  token?: string;
}
export default class IntercomWrapper extends Component<HotjarWrapperProps> {

  render() {
    const token = this.props.token;
    if (!windowIso.isSsr && initializedToken !== token && token) {
      try {
        // Add Chatwoot Settings
        windowIso['chatwootSettings'] = {
          hideMessageBubble: false,
          position: 'right', // This can be left or right
          locale: 'en', // Language to be set
          type: 'standard', // [standard, expanded_bubble]
        };

        // Paste the script from inbox settings except the <script> tag
        (function () {
          var BASE_URL = "<your-installation-url>";
          var g = windowIso.document.createElement("script"), s = windowIso.document.getElementsByTagName("script")[0];
          g.src = BASE_URL + "/packs/js/sdk.js";
          s.parentNode?.insertBefore(g, s);
          g.async = !0;
          g.onload = function () {
            windowIso['chatwootSDK'].run({
              websiteToken: '<your-website-token>',
              baseUrl: BASE_URL
            })
          }
        })();

        initializedToken = token;
      } catch (e) { }
    }

    return null;
  }
}
