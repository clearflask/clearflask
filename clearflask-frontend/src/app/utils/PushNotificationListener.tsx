import React, { Component, PropsWithChildren } from 'react';
import { Server, Status } from '../../api/server';

interface Props {
  server: Server;
}

export default class PushNotificationListener extends Component<Props> {
  static mockTrigger:()=>void|undefined;

  constructor(props) {
    super(props);
    PushNotificationListener.mockTrigger = () => this.messageReceived({date:{type:'update-notification-list'}});
  }

  messageReceived(event) {
    const loggedInUser = this.props.server.getStore().getState().users.loggedIn;
    if(typeof event === 'object' && event.data && event.data.type === 'update-notification-list'
      && loggedInUser.status === Status.FULFILLED && loggedInUser.user && loggedInUser.user.userId) {
      this.props.server.dispatch().notificationSearch({
        projectId: this.props.server.getProjectId(),
      });
    }
  }

  componentDidMount = () => navigator.serviceWorker && navigator.serviceWorker.addEventListener('message', this.messageReceived.bind(this));
  componentWillUnmount = () => navigator.serviceWorker && navigator.serviceWorker.removeEventListener('message', this.messageReceived.bind(this));

  render = () => null;

}
