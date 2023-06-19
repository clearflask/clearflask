// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { loadableReady } from '@loadable/component';
import * as Sentry from "@sentry/react";
import { Integrations } from "@sentry/tracing";
import ReactDOM from 'react-dom';
import { detectEnv, Environment, isProd } from './common/util/detectEnv';
import { getI18n } from './i18n-csr';
import Main from './Main';

Sentry.init({
  dsn: "https://600460a790e34b3e884ebe25ed26944d@o934836.ingest.sentry.io/5884409",
  integrations: [new Integrations.BrowserTracing()],
  tracesSampleRate: !isProd() ? 1.0 : 0.1,
  replaysSessionSampleRate: !isProd() ? 1.0 : 0.1,
  replaysOnErrorSampleRate: !isProd() ? 1.0 : 0.1,
  environment: detectEnv(),
});

if (detectEnv() !== Environment.DEVELOPMENT_FRONTEND) {
  loadableReady(() => {
    ReactDOM.hydrate((<Main i18n={getI18n()} />), document.getElementById('mainScreen'));
  })
} else {
  ReactDOM.render((<Main i18n={getI18n()} />), document.getElementById('mainScreen'));
}
