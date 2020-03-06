import { useSnackbar } from 'notistack';
import { detectEnv, Environment } from '../../common/util/detectEnv';

const EnvironmentNotifier = () => {
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const env = detectEnv();
  if (env === Environment.PRODUCTION) return null;
  console.log("Environment:", env);
  enqueueSnackbar("Environment: " + env, {
    variant: 'info',
    preventDuplicate: true,
  });
  return null;
};

export default EnvironmentNotifier;
