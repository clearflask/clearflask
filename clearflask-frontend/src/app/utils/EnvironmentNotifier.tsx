import { useSnackbar } from 'notistack';
import { detectEnv, Environment } from '../../common/util/detectEnv';

var wasShown = false;
const EnvironmentNotifier = () => {
  const { enqueueSnackbar } = useSnackbar();
  const env = detectEnv();

  if (env === Environment.PRODUCTION) return null;

  if (wasShown) return null;
  wasShown = true;

  console.log("Environment:", env);
  enqueueSnackbar("Environment: " + env, {
    variant: 'info',
    preventDuplicate: true,
  });
  return null;
};

export default EnvironmentNotifier;
