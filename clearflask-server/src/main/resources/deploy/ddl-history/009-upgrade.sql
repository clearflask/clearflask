 -- SPDX-FileCopyrightText: 2023 Matus Faro <matus@smotana.com>
 -- SPDX-License-Identifier: Apache-2.0

-- Upgrade
-- kpm migrations killbill killbill-0.22.20 killbill-0.22.32
CREATE INDEX invoice_billing_events_tenant_account_record_id ON invoice_billing_events(tenant_record_id, account_record_id);
