// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { detectEnv, Environment } from "../util/detectEnv";
import windowIso from "../windowIso";

export enum Status {
  Unsupported = 'unsupported',
  Available = 'available',
  Denied = 'denied',
  Granted = 'granted',
}

export interface WebNotificationSubscription {
  type: 'success';
  token: string;
}

export interface WebNotificationError {
  type: 'error';
  userFacingMsg?: string;
}

// Also set in config-aws.cfg
const KEY_PUBLIC = 'BP7Bm7jiQKOFKJTO2LEDVidsA_OtlHfsIeFZLZjc015R8iARXNX5QL5yWd3XGxmRkhII5kQrv97IjMQHpVJDO2U=';
const KEY_DEV_PUBLIC = 'BP9VGiKBRz1O5xzZDh_QBS8t9HJHITCmh4qr4M07gSiA03IFoFiusd4DMmILjWoUOwEnlStidlofxldYb1-qLJ0';
export const KEY_DEV_PRIVATE = '6xIMnmOfFz4xxsSw1h0ZhPCYuCfed56oNA7AEOSfHWE';
const SERVICE_WORKER_URL = '/sw.js';

export default class WebNotification {
  static instance: WebNotification;
  isMock: boolean;
  mockAskPermission?: () => Promise<WebNotificationSubscription | WebNotificationError>;
  status: Status = Status.Unsupported;
  unsubscribeCall?: () => Promise<boolean>;
  swRegistration?: ServiceWorkerRegistration;
  token?: string;

  constructor(isMock: boolean = false, status: Status = Status.Unsupported, mockAskPermission?: () => Promise<WebNotificationSubscription | WebNotificationError>) {
    this.isMock = isMock;
    this.mockAskPermission = mockAskPermission;
    this.status = status;
    if (!this.isMock) {
      this._checkStatus();
    }
  }

  static getInstance(): WebNotification {
    return this.instance || (this.instance = new this());
  }
  static getMockInstance(status: Status = Status.Unsupported, mockAskPermission?: () => Promise<WebNotificationSubscription | WebNotificationError>): WebNotification {
    return new this(true, status, mockAskPermission);
  }

  getStatus(): Status {
    return this.status;
  }

  getSwRegistration(): ServiceWorkerRegistration | undefined {
    return this.swRegistration;
  }

  canAskPermission(): boolean {
    return this.status !== Status.Unsupported
      && this.status !== Status.Denied;
  }

  async getPermission(): Promise<WebNotificationSubscription | WebNotificationError> {
    if (windowIso.isSsr) {
      return { type: 'error' };
    }
    this.swRegistration = await windowIso.navigator.serviceWorker?.getRegistration(SERVICE_WORKER_URL);
    const pushSubscription = await this.swRegistration?.pushManager.getSubscription();
    if (pushSubscription === null) {
      return {
        type: 'error',
        userFacingMsg: 'Failed to get notification permission',
      };
    } else {
      return {
        type: 'success',
        token: JSON.stringify(pushSubscription),
      };
    }
  }

  async askPermission(): Promise<WebNotificationSubscription | WebNotificationError> {
    if (windowIso.isSsr) {
      return { type: 'error' };
    }

    if (this.isMock) return this.mockAskPermission!();

    if (this.status === Status.Granted) {
      this.getPermission();
    }

    if (this.status === Status.Unsupported) {
      return {
        type: 'error',
        userFacingMsg: 'Cannot ask for permission when unsupported',
      };
    }

    try {
      this.swRegistration = await windowIso.navigator.serviceWorker.register(SERVICE_WORKER_URL, {
        scope: '/',
      });
    } catch (err) {
      this.status = Status.Unsupported;
      return {
        type: 'error',
        userFacingMsg: 'Failed to register notification service',
      };
    }

    // Await sw to be ready before continuing
    await windowIso.navigator.serviceWorker.ready;

    var pushSubscription: PushSubscription;
    try {
      pushSubscription = await this.swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this._urlB64ToUint8Array(this._getPublicKey()),
      });
    } catch (err) {
      console.log('Failed to subscribe to notification service', err);
      this.status = Status.Unsupported;
      return {
        type: 'error',
        userFacingMsg: 'Failed to subscribe to notification service',
      };
    }

    this.unsubscribeCall = pushSubscription.unsubscribe;
    this.status = Status.Granted;
    return {
      type: 'success',
      token: JSON.stringify(pushSubscription),
    };
  }

  unsubscribe() {
    this.unsubscribeCall && this.unsubscribeCall();
  }

  mockSetStatus(status: Status) { this.status = status };

  mockSetAskPermission(mockAskPermission?: () => Promise<WebNotificationSubscription | WebNotificationError>) { this.mockAskPermission = mockAskPermission };

  _checkStatus() {
    if (!windowIso.isSsr
      && 'Notification' in windowIso
      && 'serviceWorker' in windowIso.navigator
      && 'PushManager' in windowIso) {
      switch (windowIso.Notification.permission) {
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

  _getPublicKey() {
    switch (detectEnv()) {
      case Environment.DEVELOPMENT_FRONTEND:
      case Environment.DEVELOPMENT_LOCAL:
        return KEY_DEV_PUBLIC;
      default:
      case Environment.PRODUCTION:
        return KEY_PUBLIC;
    }
  }

  _urlB64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = !windowIso.isSsr && windowIso.atob(base64) || '';
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }
}
