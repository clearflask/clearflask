// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { useSnackbar } from 'notistack';
import { detectEnv, isProd } from '../../common/util/detectEnv';

var wasShown = false;
const EnvironmentNotifier = () => {
  const { enqueueSnackbar } = useSnackbar();

  if (isProd()) return null;

  if (wasShown) return null;
  wasShown = true;

  const env = detectEnv();
  console.log("Environment:", env);
  enqueueSnackbar("Environment: " + env, {
    preventDuplicate: true,
  });
  return null;
};

export default EnvironmentNotifier;
