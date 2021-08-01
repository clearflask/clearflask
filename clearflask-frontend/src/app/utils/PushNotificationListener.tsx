// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { Component } from 'react';
import { Server, Status } from '../../api/server';
import windowIso from '../../common/windowIso';

interface Props {
  server: Server;
}

export default class PushNotificationListener extends Component<Props> {
  static mockTrigger: () => void | undefined;

  constructor(props) {
    super(props);
    PushNotificationListener.mockTrigger = () => this.messageReceived({ date: { type: 'update-notification-list' } });
  }

  messageReceived(event) {
    const loggedInUser = this.props.server.getStore().getState().users.loggedIn;
    if (typeof event === 'object' && event.data && event.data.type === 'update-notification-list'
      && loggedInUser.status === Status.FULFILLED && loggedInUser.user && loggedInUser.user.userId) {
      this.props.server.dispatch().then(d => d.notificationSearch({
        projectId: this.props.server.getProjectId(),
      }));
    }
  }

  componentDidMount = () => !windowIso.isSsr && windowIso.navigator.serviceWorker && windowIso.navigator.serviceWorker.addEventListener('message', this.messageReceived.bind(this));
  componentWillUnmount = () => !windowIso.isSsr && windowIso.navigator.serviceWorker && windowIso.navigator.serviceWorker.removeEventListener('message', this.messageReceived.bind(this));

  render = () => null;

}
