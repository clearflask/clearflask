import { useSnackbar, VariantType } from 'notistack';
import * as Admin from '../../api/admin';

var wasShown = false;
const SubscriptionStatusNotifier = (props: {
  account:Admin.AccountAdmin
}) => {
  const { enqueueSnackbar } = useSnackbar();

  if (wasShown) return null;
  wasShown = true;

  var variant: VariantType = 'info';
  var content: string | undefined;
  switch (props.account.subscriptionStatus) {
    case Admin.SubscriptionStatus.Active:
    case Admin.SubscriptionStatus.ActiveTrial:
      break;
    case Admin.SubscriptionStatus.ActivePaymentRetry:
      variant = 'warning';
      content = 'Please correct your billing';
      break;
    case Admin.SubscriptionStatus.ActiveNoRenewal:
      variant = 'warning';
      content = 'Your account will soon expire';
      break;
    case Admin.SubscriptionStatus.Pending:
      variant = 'info';
      content = 'Your plan will soon start';
      break;
    case Admin.SubscriptionStatus.TrialExpired:
      variant = 'error';
      content = 'Your trial is expired, correct your billing';
      break;
    case Admin.SubscriptionStatus.Blocked:
      variant = 'error';
      content = 'Your account is blocked, contact support';
      break;
    case Admin.SubscriptionStatus.Cancelled:
      variant = 'error';
      content = 'Your account is cancelled, update your billing to continue';
      break;
  }

  if(content) {
    enqueueSnackbar(content, {
      variant,
      preventDuplicate: true,
      persist: true,
    });
  }

  return null;
};

export default SubscriptionStatusNotifier;
