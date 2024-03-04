// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { Button } from '@material-ui/core';
import { SnackbarKey, useSnackbar, VariantType } from 'notistack';
import { useHistory } from 'react-router';
import * as Admin from '../../api/admin';
import ServerAdmin from '../../api/serverAdmin';
import { detectEnv, Environment } from '../../common/util/detectEnv';

var lastShown: Admin.SubscriptionStatus | undefined;
var lastKey: SnackbarKey;
const SubscriptionStatusNotifier = (props: {
  account: Admin.AccountAdmin
}) => {
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const history = useHistory();

  if (lastShown === props.account.subscriptionStatus) return null;
  lastShown = props.account.subscriptionStatus;
  closeSnackbar(lastKey);

  var persist: boolean = true;
  var variant: VariantType = 'info';
  var content: string | undefined;
  var billingButtonTitle = 'Billing';
  switch (props.account.subscriptionStatus) {
    case Admin.SubscriptionStatus.Active:
    case Admin.SubscriptionStatus.ActiveTrial:
      break;
    case Admin.SubscriptionStatus.ActivePaymentRetry:
      variant = 'warning';
      content = 'We cannot process your payment';
      break;
    case Admin.SubscriptionStatus.ActiveNoRenewal:
      variant = 'warning';
      content = 'Your account will soon expire';
      persist = false;
      break;
    case Admin.SubscriptionStatus.Limited:
      variant = 'warning';
      content = 'You have reached your plan limit, please delete some posts';
      billingButtonTitle = 'Check again';
      break;
    case Admin.SubscriptionStatus.NoPaymentMethod:
      variant = 'warning';
      content = 'Please add a payment method';
      billingButtonTitle = 'Add';
      break;
    case Admin.SubscriptionStatus.Blocked:
      variant = 'error';
      content = detectEnv() === Environment.PRODUCTION_SELF_HOST
        ? 'Your current license is invalid, update your billing to continue'
        : 'Your account is blocked, contact support';
      break;
    case Admin.SubscriptionStatus.Cancelled:
      variant = 'error';
      content = detectEnv() === Environment.PRODUCTION_SELF_HOST
        ? 'Your current plan requires a license, update your billing to continue'
        : 'Your account is cancelled, update your billing to continue';
      break;
  }

  if (content) {
    lastKey = enqueueSnackbar(content, {
      variant,
      preventDuplicate: true,
      persist,
      action: (key) => (
        <Button
          color='inherit'
          onClick={async () => {
            await ServerAdmin.get().getStore().dispatch({ type: 'billingClear' });
            history.push('/dashboard/settings/account/billing');
            !persist && closeSnackbar(key);
          }}
        >{billingButtonTitle}</Button>
      ),
    });
  }

  return null;
};

export default SubscriptionStatusNotifier;
