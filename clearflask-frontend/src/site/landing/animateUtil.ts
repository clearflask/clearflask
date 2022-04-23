// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { RefObject } from 'react';
import { StateSettings } from "../../api/server";
import InViewObserver from "../../common/InViewObserver";
import { isPageVisible, waitUntilPageVisible } from '../../common/util/pageVisibility';

export function animateWrapper<StateUpdate>(
  isMountedGetter: () => boolean,
  inViewObserverRef: RefObject<InViewObserver>,
  settingsGetter: () => StateSettings,
  setState: (state: StateUpdate, callback: () => void) => void,
): ((opts?: {
  sleepInMs?: number;
  setState?: StateUpdate;
}) => Promise<boolean>) {
  return async opts => {
    if (opts?.sleepInMs && opts.sleepInMs > 0) await new Promise<void>(resolve => setTimeout(resolve, opts.sleepInMs));
    await inViewObserverRef.current?.get();
    if (!isPageVisible()) await waitUntilPageVisible();
    if (!isMountedGetter()) return true;
    if (!!settingsGetter().demoUserIsInteracting) return true;
    const newState = opts?.setState;
    try {
      if (newState !== undefined) await new Promise<void>(resolve => {
        setState(newState, resolve)
      });
    } catch (er) {
      console.log(er, opts);
      return true;
    }
    if (!isMountedGetter()) return true;
    return false;
  };
}