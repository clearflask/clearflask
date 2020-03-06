
export default class MobileNotification {
  static instance: MobileNotification;
  readonly isMock: boolean;
  mockAskPermission?: () => Promise<MobileNotificationSubscription | MobileNotificationError>;
  status: Status;
  device: Device = Device.None;

  constructor(isMock: boolean, status: Status = Status.Disconnected, mockAskPermission?: () => Promise<MobileNotificationSubscription | MobileNotificationError>) {
    this.isMock = isMock;
    this.status = status;
    this.mockAskPermission = mockAskPermission;
  }

  static getInstance(): MobileNotification {
    return this.instance || (this.instance = new this(false));
  }
  static getMockInstance(status: Status = Status.Disconnected, mockAskPermission?: () => Promise<MobileNotificationSubscription | MobileNotificationError>): MobileNotification {
    return new this(true, status, mockAskPermission);
  }

  startListen(): void {
    // TODO
  }

  getStatus(): Status {
    return this.status;
  }

  getDevice(): Device {
    return this.device;
  }

  canAskPermission(): boolean {
    return this.status !== Status.Disconnected
      && this.status !== Status.Denied;
  }

  askPermission(): Promise<MobileNotificationSubscription | MobileNotificationError> {
    if (this.isMock) return this.mockAskPermission ? this.mockAskPermission() : Promise.reject('Mock incorrectly setup');

    return Promise.resolve({
      type: 'success',
      device: this.device,
      token: 'fake-token',
    } as MobileNotificationSubscription)
  }

  mockSetStatus(status: Status) { if (this.isMock) this.status = status };

  mockSetDevice(device: Device) { if (this.isMock) this.device = device };

  mockSetAskPermission(mockAskPermission?: () => Promise<MobileNotificationSubscription | MobileNotificationError>) { if (this.isMock) this.mockAskPermission = mockAskPermission };
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
  type: 'success';
  device: Device;
  token: string;
}

export interface MobileNotificationError {
  type: 'error';
  userFacingMsg?: string,
}
