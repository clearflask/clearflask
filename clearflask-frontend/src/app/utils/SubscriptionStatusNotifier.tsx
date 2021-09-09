// SPDX-FileCopyrightText: 2019-2020 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { Button } from '@material-ui/core';
import { useSnackbar, VariantType } from 'notistack';
import { useHistory } from 'react-router';
import * as Admin from '../../api/admin';

var wasShown = false;
const SubscriptionStatusNotifier = (props: {
  account: Admin.AccountAdmin
}) => {
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const history = useHistory();

  if (wasShown) return null;
  wasShown = true;

  var persist: boolean = true;
  var variant: VariantType = 'info';
  var content: string | undefined;
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
    case Admin.SubscriptionStatus.NoPaymentMethod:
      variant = 'warning';
      content = 'Please add a payment method';
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

  if (content) {
    enqueueSnackbar(content, {
      variant,
      preventDuplicate: true,
      persist,
      action: (key) => (
        <Button
          color='inherit'
          onClick={() => {
            history.push('/dashboard/settings/account/billing');
            closeSnackbar(key);
          }}
        >Billing</Button>
      ),
    });
  }

  return null;
};

export default SubscriptionStatusNotifier;
