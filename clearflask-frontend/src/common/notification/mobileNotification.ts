
export default class MobileNotification {
  static instance:MobileNotification;
  static instanceMock:MobileNotification;
  readonly isMock:boolean;
  status:Status = Status.Available; // TODO
  device:Device = Device.None;

  constructor(isMock:boolean) {
    this.isMock = isMock;
    if(isMock) {
      this.status = Status.Subscribed;
    }
  }

  static getInstance():MobileNotification {
    return this.instance || (this.instance = new this(false));
  }
  static getMockInstance():MobileNotification {
    return this.instanceMock || (this.instanceMock = new this(true));
  }

  startListen():void {
    // TODO
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
    if(this.isMock) return Promise.resolve({
      type: 'success',
      device: Device.Ios,
      token: 'mock-token',
    } as MobileNotificationSubscription);

    return Promise.resolve({
      type: 'success',
      device: this.device,
      token:'fake-token',
    } as MobileNotificationSubscription)
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
  Ios = 'ios',
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
