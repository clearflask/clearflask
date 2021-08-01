// SPDX-FileCopyrightText: 2019-2020 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { useSnackbar, VariantType } from 'notistack';
import * as Admin from '../../api/admin';

var wasShown = false;
const SubscriptionStatusNotifier = (props: {
  account: Admin.AccountAdmin
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
      content = 'We cannot process your payment';
      break;
    case Admin.SubscriptionStatus.ActiveNoRenewal:
      variant = 'warning';
      content = 'Your account will soon expire';
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
      persist: true,
    });
  }

  return null;
};

export default SubscriptionStatusNotifier;
