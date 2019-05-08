
export default class MobileNotification {
  static instance:MobileNotification;
  status:Status = Status.Disconnected;
  device:Device = Device.None;

  static getInstance():MobileNotification {
    return this.instance || (this.instance = new this());
  }

  startListen():void {
  }

  getStatus():Status {
    return this.status;
  }

  getDevice():Device {
    return this.device;
  }

  canAskPermission():boolean {
    return this.status !== Status.Disconnected
      && this.status !== Status.Denied;
  }

  askPermission():Promise<MobileNotificationSubscription|MobileNotificationError> {
    return Promise.resolve({
      type: 'success' as 'success',
      device: this.device,
      token:'fake-token',
    })
  }
}

export enum Status {
  Disconnected = 'disconnected',
  Available = 'available',
  Denied = 'denied',
  Subscribed = 'subscribed',
}

export enum Device {
  None = 'none',
  IOS = 'ios',
  Android = 'android',
}

export interface MobileNotificationSubscription {
  type:'success';
  device:Device;
  token:string;
}

export interface MobileNotificationError {
  type:'error';
  userFacingMsg?:string,
}
