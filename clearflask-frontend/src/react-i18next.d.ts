// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import 'react-i18next';
import app from './locales/en/app.json';
import site from './locales/en/site.json';

// react-i18next versions lower than 11.11.0
declare module 'react-i18next' {
  // and extend them!
  interface Resources {
    site: typeof site;
    app: typeof app;
  }
}

declare module 'react-i18next' {
  interface CustomTypeOptions {
    // custom namespace type if you changed it
    defaultNS: 'app';
    // custom resources type
    resources: {
      site: typeof site;
      app: typeof app;
    };
  };
};
