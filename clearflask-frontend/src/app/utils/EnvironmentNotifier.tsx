// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { useEffect } from 'react';
import { useSnackbar } from 'notistack';
import { detectEnv, isProd } from '../../common/util/detectEnv';

var wasShown = false;
const EnvironmentNotifier = () => {
  const { enqueueSnackbar } = useSnackbar();

  useEffect(() => {
    if (isProd()) return;
    if (wasShown) return;
    wasShown = true;

    const env = detectEnv();
    console.log("Environment:", env);
    enqueueSnackbar("Environment: " + env, {
      preventDuplicate: true,
    });
  }, [enqueueSnackbar]);

  return null;
};

export default EnvironmentNotifier;
