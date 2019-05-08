
export default class WebNotification {
  static instance:WebNotification;
  status:Status = Status.Unsupported;

  static getInstance():WebNotification {
    return this.instance || (this.instance = new this());
  }

  constructor() {
    this._checkStatus();
  }

  getStatus():Status {
    return this.status;
  }

  canAskPermission():boolean {
    return this.status !== Status.Unsupported
      && this.status !== Status.Denied;
  }

  askPermission():Promise<WebNotificationSubscription|WebNotificationError> {
    // TODO register Service Worker
    if(this.status === Status.Unsupported) {
      throw Error('Cannot ask for permission when unsupported');
    }
    return (window['Notification']['requestPermission']() as Promise<string>)
    .then((permission):(WebNotificationSubscription|WebNotificationError) => {
      this._checkStatus();
      if(this.status === Status.Granted) {
        return {
          type: 'success',
          token: 'fake-token',
        };
      } else {
        return {
          type: 'error',
        };
      }
    }, (err):WebNotificationError => {
      console.log('notification setup failed with err:', err);
      return {
        type: 'error',
        userFacingMsg: 'Failed to setup',
      };
    })
  }

  _checkStatus() {
    if('Notification' in window
      && 'serviceWorker' in navigator
      && 'PushManager' in window) {
      switch(window['Notification']['permission']) {
        case 'granted':
          this.status = Status.Granted;
          break;
        case 'denied':
          this.status = Status.Denied;
          break;
        case 'default':
          this.status = Status.Available;
          break;
        default:
          this.status = Status.Unsupported;
          break;
      }
    } else {
      this.status = Status.Unsupported;
    }
  }
}

export enum Status {
  Unsupported = 'unsupported',
  Available = 'available',
  Denied = 'denied',
  Granted = 'granted',
}

export interface WebNotificationSubscription {
  type:'success';
  token:string;
}

export interface WebNotificationError {
  type:'error';
  userFacingMsg?:string;
}
