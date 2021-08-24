// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { loadableReady } from '@loadable/component';
import * as Sentry from "@sentry/react";
import { Integrations } from "@sentry/tracing";
import React from 'react';
import ReactDOM from 'react-dom';
import { detectEnv, Environment, isProd } from './common/util/detectEnv';
import windowIso from './common/windowIso';
import Main from './Main';

if (!windowIso.isSsr) {
  Sentry.init({
    dsn: "https://600460a790e34b3e884ebe25ed26944d@o934836.ingest.sentry.io/5884409",
    integrations: [new Integrations.BrowserTracing()],
    tracesSampleRate: !isProd() ? 1.0 : 0.1,
    environment: detectEnv(),
  });
}

if (detectEnv() !== Environment.DEVELOPMENT_FRONTEND) {
  loadableReady(() => {
    ReactDOM.hydrate(<Main />, document.getElementById('mainScreen'));
  })
} else {
  ReactDOM.render(<Main />, document.getElementById('mainScreen'));
}
