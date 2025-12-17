// SPDX-FileCopyrightText: 2025 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0

import Castle from '@castleio/castle-js';
import { detectEnv, Environment } from '../common/util/detectEnv';
import windowIso from '../common/windowIso';
import * as Admin from '../api/admin';
import * as Client from '../api/client';
import { RouteComponentProps } from 'react-router';
import { ReduxStateAdmin } from '../api/serverAdmin';
import { shallowEqual, useSelector } from 'react-redux';
import { useEffect, useState } from 'react';
import { ReduxState } from '../api/server';

/** Matches CastleAntiSpam.java */
const HEADER_CASTLE_REQUEST_TOKEN = 'castle-request-token';
var castleInstance: ReturnType<typeof Castle.configure> | null | undefined = undefined;

export const getCastle = (): ReturnType<typeof Castle.configure> | null => {
  if (castleInstance === undefined) {
    try {
      const env = detectEnv();
      if (!windowIso.isSsr && (
        env === Environment.PRODUCTION
        // Disable Castle in local development to avoid invisible iframe overlay
        // || env === Environment.DEVELOPMENT_FRONTEND
        // || env === Environment.DEVELOPMENT_LOCAL
      )) {
        castleInstance = Castle.configure({
          // https://dashboard.castle.io/settings/configuration
          pk: 'pk_QdoBBarxsAtSiwys4exUUxKGNsQC4WBm',
        });
      } else {
        castleInstance = null;
      }
    } catch (e) {
      console.error('Castle initialization failed', e);
      castleInstance = null;
    }
  }
  return castleInstance;
};

export const getCastleApiMiddleware = (): Admin.Middleware | Client.Middleware | null => {
  // Castle.io disabled
  return null;
};

export const CastlePageTrack = (props: {
  routeProps: RouteComponentProps,
  track: 'user' | 'account',
}) => {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const account = useState(props.track === 'account')[0] && useSelector<ReduxStateAdmin, Admin.AccountAdmin | undefined>(state => state.account.account.account, shallowEqual);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const user = useState(props.track === 'user')[0] && useSelector<ReduxState, Client.UserMe | undefined>(state => state.users.loggedIn.user, shallowEqual);
  const castle = getCastle();

  const isLoggedIn = !!account || !!user;
  useEffect(() => {
    if (!castle) {
      return;
    }
    let castleUser: any;
    if (!!account) {
      castleUser = {
        id: account.accountId,
        email: account.email,
        name: account.name,
        traits: {
          type: !!account.isSuperAdmin ? 'superAdmin' : 'admin',
          basePlanId: account.basePlanId,
          subscriptionStatus: account.subscriptionStatus,
        },
      };
    } else if (!!user) {
      castleUser = {
        id: user.userId,
        email: user.email,
        name: user.name,
        traits: {
          type: !!user.isMod ? 'mod' : 'user',
        },
      };
    } else {
      return;
    }
    try {
      castle.page({
        // TODO use account/user JWT from backend
        user: castleUser,
      }).then((result) => {
        if (result === false) {
          console.error('Castle page track returned failure');
        }
      });
    } catch (e) {
      console.error('Castle page track failed', e);
    }
  }, [ // eslint-disable-line react-hooks/exhaustive-deps
    isLoggedIn,
    castle,
    // Emit on route change
    props.routeProps.location.pathname,
    props.routeProps.location.search,
  ]);

  return null;
};
