// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import windowIso from "../windowIso";
import { isProd } from "./detectEnv";

const CookieConsentName = 'cookie-user-consent';

const getConsentFromCookie = (): boolean | undefined => {
  if (windowIso.isSsr) return;
  const cookies = ' ' + windowIso.document.cookie
  const parts = cookies.split(' ' + CookieConsentName + '=')
  const value = parts.length < 2
    ? undefined
    : parts.pop()?.split(';').shift();
  if (value === 'accepted') return true;
  if (value === 'rejected') return false;
  return undefined;
}

export const setConsentToCookie = function (value: boolean) {
  if (windowIso.isSsr) return;
  windowIso.document.cookie = `${CookieConsentName}=${value ? 'accepted' : 'rejected'}; Path=/; SameSite=Strict;`;
}

var isConsented: boolean | undefined = getConsentFromCookie();
const doTrackingBacklog: Array<() => void> = [];

const isTracking = (): boolean => {
  return isProd() && !windowIso.isSsr;
}

export function trackingBlock(doTrackingStuff: () => void) {
  if (!isTracking()) return;
  if (isConsented) {
    doTrackingStuff();
  } else {
    doTrackingBacklog.push(doTrackingStuff);
  }
}

// Call when user explicitly accepted cookie consent
export function trackingConsent() {
  setConsentToCookie(true);
  trackingImplicitConsent();
}

// Call when there is no cookie consent required
export function trackingImplicitConsent() {
  isConsented = true;

  if (!isTracking()) return;

  while (doTrackingBacklog.length > 0) {
    const doTrackingStuff = doTrackingBacklog.shift();
    doTrackingStuff?.();
  }
}

// Call when user explicitly rejected cookie consent
export function trackingReject() {
  setConsentToCookie(false);
  isConsented = false;
}

export function trackingIsConsented(): boolean | undefined {
  return isConsented;
}
