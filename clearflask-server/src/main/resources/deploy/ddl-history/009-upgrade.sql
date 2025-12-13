 -- SPDX-FileCopyrightText: 2023 Matus Faro <matus@smotana.com>
 -- SPDX-License-Identifier: Apache-2.0

USE killbill;

-- Upgrade
-- kpm migrations killbill killbill-0.22.20 killbill-0.22.32
CREATE INDEX invoice_billing_events_tenant_account_record_id ON invoice_billing_events(tenant_record_id, account_record_id);

-- killbill-analytics-plugin V20210405133036__add_source_name_source_query_to_analytics_reports.sql
alter table analytics_reports modify source_table_name varchar(256) default null;
alter table analytics_reports add source_name varchar(256) default null after source_table_name;
alter table analytics_reports add source_query varchar(4096) default null after source_name;

-- killbill-analytics-plugin V20230712110325__rename_value_to_field_value_in_all_tables.sql
ALTER TABLE analytics_account_fields CHANGE COLUMN `value` field_value varchar(255) default null;
ALTER TABLE analytics_bundle_fields CHANGE COLUMN `value` field_value varchar(255) default null;
ALTER TABLE analytics_invoice_fields CHANGE COLUMN `value` field_value varchar(255) default null;
ALTER TABLE analytics_invoice_payment_fields CHANGE COLUMN `value` field_value varchar(255) default null;
ALTER TABLE analytics_payment_fields CHANGE COLUMN `value` field_value varchar(255) default null;
ALTER TABLE analytics_payment_method_fields CHANGE COLUMN `value` field_value varchar(255) default null;
ALTER TABLE analytics_transaction_fields CHANGE COLUMN `value` field_value varchar(255) default null;

