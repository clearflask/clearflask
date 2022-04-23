 -- SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
 -- SPDX-License-Identifier: Apache-2.0
-- PLUGIN DDL
-- source: killbill-server/target/kb-ddl/plugins.sql

USE killbill;

-- PLUGIN DDL -> analytics-plugin
drop table if exists report_accounts_summary;
drop table if exists report_active_by_product_term_monthly;
drop table if exists report_cancellations_daily;
drop table if exists report_chargebacks_daily;
drop table if exists report_invoices_balance_daily;
drop table if exists report_invoices_daily;
drop table if exists report_mrr_daily;
drop table if exists report_new_accounts_daily;
drop table if exists report_payment_provider_conversion_history;
drop table if exists report_payment_provider_errors_sub2;
drop table if exists report_payment_provider_errors;
drop table if exists report_payment_provider_monitor_history;
drop table if exists report_payments_by_provider_history;
drop table if exists report_payments_by_provider_last_24h_summary;
drop table if exists report_payments_total_daily;
drop table if exists report_refunds_total_daily;

-- PLUGIN DDL -> analytics-plugin -> ddl.sql
;

DROP TABLE IF EXISTS notifications;
CREATE TABLE notifications (
    record_id serial unique,
    class_name varchar(256) NOT NULL,
    event_json varchar(2048) NOT NULL,
    user_token varchar(36),
    created_date datetime NOT NULL,
    creating_owner varchar(50) NOT NULL,
    processing_owner varchar(50) DEFAULT NULL,
    processing_available_date datetime DEFAULT NULL,
    processing_state varchar(14) DEFAULT 'AVAILABLE',
    error_count int  DEFAULT 0,
    search_key1 bigint  default null,
    search_key2 bigint  default null,
    queue_name varchar(64) NOT NULL,
    effective_date datetime NOT NULL,
    future_user_token varchar(36),
    PRIMARY KEY(record_id)
) ;
CREATE INDEX idx_comp_where ON notifications(effective_date, processing_state, processing_owner, processing_available_date);
CREATE INDEX idx_update ON notifications(processing_state, processing_owner, processing_available_date);
CREATE INDEX idx_get_ready ON notifications(effective_date, created_date);
CREATE INDEX notifications_search_keys ON notifications(search_key2, search_key1);

DROP TABLE IF EXISTS notifications_history;
CREATE TABLE notifications_history (
    record_id serial unique,
    class_name varchar(256) NOT NULL,
    event_json varchar(2048) NOT NULL,
    user_token varchar(36),
    created_date datetime NOT NULL,
    creating_owner varchar(50) NOT NULL,
    processing_owner varchar(50) DEFAULT NULL,
    processing_available_date datetime DEFAULT NULL,
    processing_state varchar(14) DEFAULT 'AVAILABLE',
    error_count int  DEFAULT 0,
    search_key1 bigint  default null,
    search_key2 bigint  default null,
    queue_name varchar(64) NOT NULL,
    effective_date datetime NOT NULL,
    future_user_token varchar(36),
    PRIMARY KEY(record_id)
) ;
CREATE INDEX notifications_history_search_keys ON notifications_history(search_key2, search_key1);

DROP TABLE IF EXISTS bus_events;
CREATE TABLE bus_events (
    record_id serial unique,
    class_name varchar(128) NOT NULL,
    event_json varchar(2048) NOT NULL,
    user_token varchar(36),
    created_date datetime NOT NULL,
    creating_owner varchar(50) NOT NULL,
    processing_owner varchar(50) DEFAULT NULL,
    processing_available_date datetime DEFAULT NULL,
    processing_state varchar(14) DEFAULT 'AVAILABLE',
    error_count int  DEFAULT 0,
    search_key1 bigint  default null,
    search_key2 bigint  default null,
    PRIMARY KEY(record_id)
) ;
CREATE INDEX idx_bus_where ON bus_events(processing_state, processing_owner, processing_available_date);
CREATE INDEX bus_events_tenant_account_record_id ON bus_events(search_key2, search_key1);

DROP TABLE IF EXISTS bus_events_history;
CREATE TABLE bus_events_history (
    record_id serial unique,
    class_name varchar(128) NOT NULL,
    event_json varchar(2048) NOT NULL,
    user_token varchar(36),
    created_date datetime NOT NULL,
    creating_owner varchar(50) NOT NULL,
    processing_owner varchar(50) DEFAULT NULL,
    processing_available_date datetime DEFAULT NULL,
    processing_state varchar(14) DEFAULT 'AVAILABLE',
    error_count int  DEFAULT 0,
    search_key1 bigint  default null,
    search_key2 bigint  default null,
    PRIMARY KEY(record_id)
) ;
CREATE INDEX bus_events_history_tenant_account_record_id ON bus_events_history(search_key2, search_key1);

-- PLUGIN DDL -> analytics-plugin -> ddl.sql
;

-- Subscription events
drop table if exists analytics_subscription_transitions;
create table analytics_subscription_transitions (
  record_id serial unique
, subscription_event_record_id bigint  default null
, bundle_id varchar(36) default null
, bundle_external_key varchar(255) default null
, subscription_id varchar(36) default null
, requested_timestamp date default null
, event varchar(50) default null
, prev_product_name varchar(255) default null
, prev_product_type varchar(50) default null
, prev_product_category varchar(50) default null
, prev_slug varchar(255) default null
, prev_phase varchar(255) default null
, prev_billing_period varchar(50) default null
, prev_price numeric(10, 4) default 0
, converted_prev_price numeric(10, 4) default null
, prev_price_list varchar(50) default null
, prev_mrr numeric(10, 4) default 0
, converted_prev_mrr numeric(10, 4) default null
, prev_currency varchar(50) default null
, prev_service varchar(50) default null
, prev_state varchar(50) default null
, prev_business_active bool default true
, prev_start_date date default null
, next_product_name varchar(255) default null
, next_product_type varchar(50) default null
, next_product_category varchar(50) default null
, next_slug varchar(255) default null
, next_phase varchar(255) default null
, next_billing_period varchar(50) default null
, next_price numeric(10, 4) default 0
, converted_next_price numeric(10, 4) default null
, next_price_list varchar(50) default null
, next_mrr numeric(10, 4) default 0
, converted_next_mrr numeric(10, 4) default null
, next_currency varchar(50) default null
, next_service varchar(50) default null
, next_state varchar(50) default null
, next_business_active bool default true
, next_start_date date default null
, next_end_date date default null
, converted_currency varchar(3) default null
, created_date datetime default null
, created_by varchar(50) default null
, created_reason_code varchar(255) default null
, created_comments varchar(255) default null
, account_id varchar(36) default null
, account_name varchar(100) default null
, account_external_key varchar(255) default null
, account_record_id bigint  default null
, tenant_record_id bigint  default null
, report_group varchar(50) not null
, primary key(record_id)
) ;
create index analytics_subscription_transitions_bundle_id on analytics_subscription_transitions(bundle_id);
create index analytics_subscription_transitions_bundle_external_key on analytics_subscription_transitions(bundle_external_key);
create index analytics_subscription_transitions_account_id on analytics_subscription_transitions(account_id);
create index analytics_subscription_transitions_account_record_id on analytics_subscription_transitions(account_record_id);
create index analytics_subscription_transitions_tenant_account_record_id on analytics_subscription_transitions(tenant_record_id, account_record_id);

-- Bundle summary
drop table if exists analytics_bundles;
create table analytics_bundles (
  record_id serial unique
, bundle_record_id bigint  default null
, bundle_id varchar(36) default null
, bundle_external_key varchar(255) default null
, subscription_id varchar(36) default null
, bundle_account_rank int default null
, latest_for_bundle_external_key bool default false
, charged_through_date date default null
, current_product_name varchar(255) default null
, current_product_type varchar(50) default null
, current_product_category varchar(50) default null
, current_slug varchar(255) default null
, current_phase varchar(255) default null
, current_billing_period varchar(50) default null
, current_price numeric(10, 4) default 0
, converted_current_price numeric(10, 4) default null
, current_price_list varchar(50) default null
, current_mrr numeric(10, 4) default 0
, converted_current_mrr numeric(10, 4) default null
, current_currency varchar(50) default null
, current_service varchar(50) default null
, current_state varchar(50) default null
, current_business_active bool default true
, current_start_date date default null
, current_end_date date default null
, converted_currency varchar(3) default null
, original_created_date datetime default null
, created_date datetime default null
, created_by varchar(50) default null
, created_reason_code varchar(255) default null
, created_comments varchar(255) default null
, account_id varchar(36) default null
, account_name varchar(100) default null
, account_external_key varchar(255) default null
, account_record_id bigint  default null
, tenant_record_id bigint  default null
, report_group varchar(50) not null
, primary key(record_id)
) ;
create index analytics_bundles_bundle_bundle_id on analytics_bundles(bundle_id);
create index analytics_bundles_bundle_external_key on analytics_bundles(bundle_external_key);
create index analytics_bundles_account_id on analytics_bundles(account_id);
create index analytics_bundles_account_record_id on analytics_bundles(account_record_id);
create index analytics_bundles_tenant_account_record_id on analytics_bundles(tenant_record_id, account_record_id);

-- Accounts
drop table if exists analytics_accounts;
create table analytics_accounts (
  record_id serial unique
, email varchar(128) default null
, first_name_length int default null
, currency varchar(3) default null
, billing_cycle_day_local int default null
, payment_method_id varchar(36) default null
, time_zone varchar(50) default null
, locale varchar(5) default null
, address1 varchar(100) default null
, address2 varchar(100) default null
, company_name varchar(50) default null
, city varchar(50) default null
, state_or_province varchar(50) default null
, country varchar(50) default null
, postal_code varchar(16) default null
, phone varchar(25) default null
, migrated bool default false
, balance numeric(10, 4) default 0
, converted_balance numeric(10, 4) default null
, oldest_unpaid_invoice_date date default null
, oldest_unpaid_invoice_balance numeric(10, 4) default null
, oldest_unpaid_invoice_currency varchar(3) default null
, converted_oldest_unpaid_invoice_balance numeric(10, 4) default null
, oldest_unpaid_invoice_id varchar(36) default null
, last_invoice_date date default null
, last_invoice_balance numeric(10, 4) default null
, last_invoice_currency varchar(3) default null
, converted_last_invoice_balance numeric(10, 4) default null
, last_invoice_id varchar(36) default null
, last_payment_date datetime default null
, last_payment_status varchar(255) default null
, nb_active_bundles int default 0
, converted_currency varchar(3) default null
, created_date datetime default null
, created_by varchar(50) default null
, created_reason_code varchar(255) default null
, created_comments varchar(255) default null
, updated_date datetime default null
, account_id varchar(36) default null
, account_name varchar(100) default null
, account_external_key varchar(255) default null
, parent_account_id varchar(36) default null
, parent_account_name varchar(100) default null
, parent_account_external_key varchar(255) default null
, account_record_id bigint  default null
, tenant_record_id bigint  default null
, report_group varchar(50) not null
, primary key(record_id)
) ;
create index analytics_accounts_account_external_key on analytics_accounts(account_external_key);
create index analytics_accounts_account_id on analytics_accounts(account_id);
create index analytics_accounts_account_record_id on analytics_accounts(account_record_id);
create index analytics_accounts_tenant_account_record_id on analytics_accounts(tenant_record_id, account_record_id);
create index analytics_accounts_created_date_tenant_record_id_report_group on analytics_accounts(created_date, tenant_record_id, report_group);

drop table if exists analytics_account_transitions;
create table analytics_account_transitions (
  record_id serial unique
, blocking_state_record_id bigint  default null
, service varchar(50) default null
, state varchar(50) default null
, start_date date default null
, end_date date default null
, created_date datetime default null
, created_by varchar(50) default null
, created_reason_code varchar(255) default null
, created_comments varchar(255) default null
, account_id varchar(36) default null
, account_name varchar(100) default null
, account_external_key varchar(255) default null
, account_record_id bigint  default null
, tenant_record_id bigint  default null
, report_group varchar(50) not null
, primary key(record_id)
) ;
create index analytics_account_transitions_account_id on analytics_account_transitions(account_id);
create index analytics_account_transitions_account_record_id on analytics_account_transitions(account_record_id);
create index analytics_account_transitions_tenant_account_record_id on analytics_account_transitions(tenant_record_id, account_record_id);
-- For sanity queries
create index analytics_account_transitions_blocking_state_record_id on analytics_account_transitions(blocking_state_record_id);

-- Invoices
drop table if exists analytics_invoices;
create table analytics_invoices (
  record_id serial unique
, invoice_record_id bigint  default null
, invoice_id varchar(36) default null
, invoice_number bigint default null
, invoice_date date default null
, target_date date default null
, currency varchar(50) default null
, raw_balance numeric(10, 4) default 0
, converted_raw_balance numeric(10, 4) default null
, balance numeric(10, 4) default 0
, converted_balance numeric(10, 4) default null
, amount_paid numeric(10, 4) default 0
, converted_amount_paid numeric(10, 4) default null
, amount_charged numeric(10, 4) default 0
, converted_amount_charged numeric(10, 4) default null
, original_amount_charged numeric(10, 4) default 0
, converted_original_amount_charged numeric(10, 4) default null
, amount_credited numeric(10, 4) default 0
, converted_amount_credited numeric(10, 4) default null
, amount_refunded numeric(10, 4) default 0
, converted_amount_refunded numeric(10, 4) default null
, converted_currency varchar(3) default null
, written_off bool default false
, created_date datetime default null
, created_by varchar(50) default null
, created_reason_code varchar(255) default null
, created_comments varchar(255) default null
, account_id varchar(36) default null
, account_name varchar(100) default null
, account_external_key varchar(255) default null
, account_record_id bigint  default null
, tenant_record_id bigint  default null
, report_group varchar(50) not null
, primary key(record_id)
) ;
create index analytics_invoices_invoice_record_id on analytics_invoices(invoice_record_id);
create index analytics_invoices_invoice_id on analytics_invoices(invoice_id);
create index analytics_invoices_account_id on analytics_invoices(account_id);
create index analytics_invoices_account_record_id on analytics_invoices(account_record_id);
create index analytics_invoices_tenant_account_record_id on analytics_invoices(tenant_record_id, account_record_id);

-- Invoice adjustments (type REFUND_ADJ)
drop table if exists analytics_invoice_adjustments;
create table analytics_invoice_adjustments (
  record_id serial unique
, invoice_item_record_id bigint  default null
, second_invoice_item_record_id bigint  default null
, item_id varchar(36) default null
, invoice_id varchar(36) default null
, invoice_number bigint default null
, invoice_created_date datetime default null
, invoice_date date default null
, invoice_target_date date default null
, invoice_currency varchar(50) default null
, raw_invoice_balance numeric(10, 4) default 0
, converted_raw_invoice_balance numeric(10, 4) default null
, invoice_balance numeric(10, 4) default 0
, converted_invoice_balance numeric(10, 4) default null
, invoice_amount_paid numeric(10, 4) default 0
, converted_invoice_amount_paid numeric(10, 4) default null
, invoice_amount_charged numeric(10, 4) default 0
, converted_invoice_amount_charged numeric(10, 4) default null
, invoice_original_amount_charged numeric(10, 4) default 0
, converted_invoice_original_amount_charged numeric(10, 4) default null
, invoice_amount_credited numeric(10, 4) default 0
, converted_invoice_amount_credited numeric(10, 4) default null
, invoice_amount_refunded numeric(10, 4) default 0
, converted_invoice_amount_refunded numeric(10, 4) default null
, invoice_written_off bool default false
, item_type varchar(50) default null
, item_source varchar(50) not null
, bundle_id varchar(36) default null
, bundle_external_key varchar(255) default null
, product_name varchar(255) default null
, product_type varchar(50) default null
, product_category varchar(50) default null
, slug varchar(255) default null
, phase varchar(255) default null
, billing_period varchar(50) default null
, start_date date default null
, end_date date default null
, amount numeric(10, 4) default 0
, converted_amount numeric(10, 4) default null
, currency varchar(50) default null
, linked_item_id varchar(36) default null
, converted_currency varchar(3) default null
, created_date datetime default null
, created_by varchar(50) default null
, created_reason_code varchar(255) default null
, created_comments varchar(255) default null
, account_id varchar(36) default null
, account_name varchar(100) default null
, account_external_key varchar(255) default null
, account_record_id bigint  default null
, tenant_record_id bigint  default null
, report_group varchar(50) not null
, primary key(record_id)
) ;
create index analytics_invoice_adjustments_invoice_item_record_id on analytics_invoice_adjustments(invoice_item_record_id);
create index analytics_invoice_adjustments_item_id on analytics_invoice_adjustments(item_id);
create index analytics_invoice_adjustments_invoice_id on analytics_invoice_adjustments(invoice_id);
create index analytics_invoice_adjustments_account_id on analytics_invoice_adjustments(account_id);
create index analytics_invoice_adjustments_account_record_id on analytics_invoice_adjustments(account_record_id);
create index analytics_invoice_adjustments_tenant_account_record_id on analytics_invoice_adjustments(tenant_record_id, account_record_id);

-- Invoice items (without adjustments, type EXTERNAL_CHARGE, FIXED, RECURRING, USAGE and TAX)
drop table if exists analytics_invoice_items;
create table analytics_invoice_items (
  record_id serial unique
, invoice_item_record_id bigint  default null
, second_invoice_item_record_id bigint  default null
, item_id varchar(36) default null
, invoice_id varchar(36) default null
, invoice_number bigint default null
, invoice_created_date datetime default null
, invoice_date date default null
, invoice_target_date date default null
, invoice_currency varchar(50) default null
, raw_invoice_balance numeric(10, 4) default 0
, converted_raw_invoice_balance numeric(10, 4) default null
, invoice_balance numeric(10, 4) default 0
, converted_invoice_balance numeric(10, 4) default null
, invoice_amount_paid numeric(10, 4) default 0
, converted_invoice_amount_paid numeric(10, 4) default null
, invoice_amount_charged numeric(10, 4) default 0
, converted_invoice_amount_charged numeric(10, 4) default null
, invoice_original_amount_charged numeric(10, 4) default 0
, converted_invoice_original_amount_charged numeric(10, 4) default null
, invoice_amount_credited numeric(10, 4) default 0
, converted_invoice_amount_credited numeric(10, 4) default null
, invoice_amount_refunded numeric(10, 4) default 0
, converted_invoice_amount_refunded numeric(10, 4) default null
, invoice_written_off bool default false
, item_type varchar(50) default null
, item_source varchar(50) not null
, bundle_id varchar(36) default null
, bundle_external_key varchar(255) default null
, product_name varchar(255) default null
, product_type varchar(50) default null
, product_category varchar(50) default null
, slug varchar(255) default null
, usage_name varchar(255) default null
, phase varchar(255) default null
, billing_period varchar(50) default null
, start_date date default null
, end_date date default null
, amount numeric(10, 4) default 0
, converted_amount numeric(10, 4) default null
, currency varchar(50) default null
, linked_item_id varchar(36) default null
, converted_currency varchar(3) default null
, created_date datetime default null
, created_by varchar(50) default null
, created_reason_code varchar(255) default null
, created_comments varchar(255) default null
, account_id varchar(36) default null
, account_name varchar(100) default null
, account_external_key varchar(255) default null
, account_record_id bigint  default null
, tenant_record_id bigint  default null
, report_group varchar(50) not null
, primary key(record_id)
) ;
create index analytics_invoice_items_invoice_item_record_id on analytics_invoice_items(invoice_item_record_id);
create index analytics_invoice_items_item_id on analytics_invoice_items(item_id);
create index analytics_invoice_items_invoice_id on analytics_invoice_items(invoice_id);
create index analytics_invoice_items_account_id on analytics_invoice_items(account_id);
create index analytics_invoice_items_account_record_id on analytics_invoice_items(account_record_id);
create index analytics_invoice_items_tenant_account_record_id on analytics_invoice_items(tenant_record_id, account_record_id);

-- Invoice items adjustments (type ITEM_ADJ)
drop table if exists analytics_invoice_item_adjustments;
create table analytics_invoice_item_adjustments (
  record_id serial unique
, invoice_item_record_id bigint  default null
, second_invoice_item_record_id bigint  default null
, item_id varchar(36) default null
, invoice_id varchar(36) default null
, invoice_number bigint default null
, invoice_created_date datetime default null
, invoice_date date default null
, invoice_target_date date default null
, invoice_currency varchar(50) default null
, raw_invoice_balance numeric(10, 4) default 0
, converted_raw_invoice_balance numeric(10, 4) default null
, invoice_balance numeric(10, 4) default 0
, converted_invoice_balance numeric(10, 4) default null
, invoice_amount_paid numeric(10, 4) default 0
, converted_invoice_amount_paid numeric(10, 4) default null
, invoice_amount_charged numeric(10, 4) default 0
, converted_invoice_amount_charged numeric(10, 4) default null
, invoice_original_amount_charged numeric(10, 4) default 0
, converted_invoice_original_amount_charged numeric(10, 4) default null
, invoice_amount_credited numeric(10, 4) default 0
, converted_invoice_amount_credited numeric(10, 4) default null
, invoice_amount_refunded numeric(10, 4) default 0
, converted_invoice_amount_refunded numeric(10, 4) default null
, invoice_written_off bool default false
, item_type varchar(50) default null
, item_source varchar(50) not null
, bundle_id varchar(36) default null
, bundle_external_key varchar(255) default null
, product_name varchar(255) default null
, product_type varchar(50) default null
, product_category varchar(50) default null
, slug varchar(255) default null
, phase varchar(255) default null
, billing_period varchar(50) default null
, start_date date default null
, end_date date default null
, amount numeric(10, 4) default 0
, converted_amount numeric(10, 4) default null
, currency varchar(50) default null
, linked_item_id varchar(36) default null
, converted_currency varchar(3) default null
, created_date datetime default null
, created_by varchar(50) default null
, created_reason_code varchar(255) default null
, created_comments varchar(255) default null
, account_id varchar(36) default null
, account_name varchar(100) default null
, account_external_key varchar(255) default null
, account_record_id bigint  default null
, tenant_record_id bigint  default null
, report_group varchar(50) not null
, primary key(record_id)
) ;
create index analytics_invoice_item_adjustments_invoice_item_record_id on analytics_invoice_item_adjustments(invoice_item_record_id);
create index analytics_invoice_item_adjustments_item_id on analytics_invoice_item_adjustments(item_id);
create index analytics_invoice_item_adjustments_invoice_id on analytics_invoice_item_adjustments(invoice_id);
create index analytics_invoice_item_adjustments_account_id on analytics_invoice_item_adjustments(account_id);
create index analytics_invoice_item_adjustments_account_record_id on analytics_invoice_item_adjustments(account_record_id);
create index analytics_invoice_item_adjustments_tenant_account_record_id on analytics_invoice_item_adjustments(tenant_record_id, account_record_id);

-- Account credits (type CBA_ADJ and CREDIT_ADJ)
drop table if exists analytics_invoice_credits;
create table analytics_invoice_credits (
  record_id serial unique
, invoice_item_record_id bigint  default null
, second_invoice_item_record_id bigint  default null
, item_id varchar(36) default null
, invoice_id varchar(36) default null
, invoice_number bigint default null
, invoice_created_date datetime default null
, invoice_date date default null
, invoice_target_date date default null
, invoice_currency varchar(50) default null
, raw_invoice_balance numeric(10, 4) default 0
, converted_raw_invoice_balance numeric(10, 4) default null
, invoice_balance numeric(10, 4) default 0
, converted_invoice_balance numeric(10, 4) default null
, invoice_amount_paid numeric(10, 4) default 0
, converted_invoice_amount_paid numeric(10, 4) default null
, invoice_amount_charged numeric(10, 4) default 0
, converted_invoice_amount_charged numeric(10, 4) default null
, invoice_original_amount_charged numeric(10, 4) default 0
, converted_invoice_original_amount_charged numeric(10, 4) default null
, invoice_amount_credited numeric(10, 4) default 0
, converted_invoice_amount_credited numeric(10, 4) default null
, invoice_amount_refunded numeric(10, 4) default 0
, converted_invoice_amount_refunded numeric(10, 4) default null
, invoice_written_off bool default false
, item_type varchar(50) default null
, item_source varchar(50) not null
, bundle_id varchar(36) default null
, bundle_external_key varchar(255) default null
, product_name varchar(255) default null
, product_type varchar(50) default null
, product_category varchar(50) default null
, slug varchar(255) default null
, phase varchar(255) default null
, billing_period varchar(50) default null
, start_date date default null
, end_date date default null
, amount numeric(10, 4) default 0
, converted_amount numeric(10, 4) default null
, currency varchar(50) default null
, linked_item_id varchar(36) default null
, converted_currency varchar(3) default null
, created_date datetime default null
, created_by varchar(50) default null
, created_reason_code varchar(255) default null
, created_comments varchar(255) default null
, account_id varchar(36) default null
, account_name varchar(100) default null
, account_external_key varchar(255) default null
, account_record_id bigint  default null
, tenant_record_id bigint  default null
, report_group varchar(50) not null
, primary key(record_id)
) ;
create index analytics_invoice_credits_invoice_item_record_id on analytics_invoice_credits(invoice_item_record_id);
create index analytics_invoice_credits_item_id on analytics_invoice_credits(item_id);
create index analytics_invoice_credits_invoice_id on analytics_invoice_credits(invoice_id);
create index analytics_invoice_credits_account_id on analytics_invoice_credits(account_id);
create index analytics_invoice_credits_account_record_id on analytics_invoice_credits(account_record_id);
create index analytics_invoice_credits_tenant_account_record_id on analytics_invoice_credits(tenant_record_id, account_record_id);

-- Payments

drop table if exists analytics_payment_auths;
create table analytics_payment_auths (
  record_id serial unique
, invoice_payment_record_id bigint  default null
, invoice_payment_id varchar(36) default null
, invoice_id varchar(36) default null
, invoice_number bigint default null
, invoice_created_date datetime default null
, invoice_date date default null
, invoice_target_date date default null
, invoice_currency varchar(50) default null
, invoice_balance numeric(10, 4) default 0
, converted_invoice_balance numeric(10, 4) default null
, invoice_amount_paid numeric(10, 4) default 0
, converted_invoice_amount_paid numeric(10, 4) default null
, invoice_amount_charged numeric(10, 4) default 0
, converted_invoice_amount_charged numeric(10, 4) default null
, invoice_original_amount_charged numeric(10, 4) default 0
, converted_invoice_original_amount_charged numeric(10, 4) default null
, invoice_amount_credited numeric(10, 4) default 0
, converted_invoice_amount_credited numeric(10, 4) default null
, invoice_amount_refunded numeric(10, 4) default 0
, converted_invoice_amount_refunded numeric(10, 4) default null
, invoice_payment_type varchar(50) default null
, payment_id varchar(36) default null
, refund_id varchar(36) default null
, payment_number bigint default null
, payment_external_key varchar(255) default null
, payment_transaction_id varchar(36) default null
, payment_transaction_external_key varchar(255) default null
, payment_transaction_status varchar(255) default null
, linked_invoice_payment_id varchar(36) default null
, amount numeric(10, 4) default 0
, converted_amount numeric(10, 4) default null
, currency varchar(50) default null
, plugin_name varchar(255) default null
, payment_method_id varchar(36) default null
, payment_method_external_key varchar(255) default null
, plugin_created_date datetime default null
, plugin_effective_date datetime default null
, plugin_status varchar(255) default null
, plugin_gateway_error text default null
, plugin_gateway_error_code varchar(255) default null
, plugin_first_reference_id varchar(255) default null
, plugin_second_reference_id varchar(255) default null
, plugin_property_1 varchar(255) default null
, plugin_property_2 varchar(255) default null
, plugin_property_3 varchar(255) default null
, plugin_property_4 varchar(255) default null
, plugin_property_5 varchar(255) default null
, plugin_pm_id varchar(255) default null
, plugin_pm_is_default bool default null
, plugin_pm_type varchar(255) default null
, plugin_pm_cc_name varchar(255) default null
, plugin_pm_cc_type varchar(255) default null
, plugin_pm_cc_expiration_month varchar(255) default null
, plugin_pm_cc_expiration_year varchar(255) default null
, plugin_pm_cc_last_4 varchar(255) default null
, plugin_pm_address1 varchar(255) default null
, plugin_pm_address2 varchar(255) default null
, plugin_pm_city varchar(255) default null
, plugin_pm_state varchar(255) default null
, plugin_pm_zip varchar(255) default null
, plugin_pm_country varchar(255) default null
, converted_currency varchar(3) default null
, created_date datetime default null
, created_by varchar(50) default null
, created_reason_code varchar(255) default null
, created_comments varchar(255) default null
, account_id varchar(36) default null
, account_name varchar(100) default null
, account_external_key varchar(255) default null
, account_record_id bigint  default null
, tenant_record_id bigint  default null
, report_group varchar(50) not null
, primary key(record_id)
) ;
create index analytics_payment_auths_created_date on analytics_payment_auths(created_date);
create index analytics_payment_auths_date_trid_plugin_name on analytics_payment_auths(created_date, tenant_record_id, plugin_name);
create index analytics_payment_auths_invoice_payment_record_id on analytics_payment_auths(invoice_payment_record_id);
create index analytics_payment_auths_invoice_payment_id on analytics_payment_auths(invoice_payment_id);
create index analytics_payment_auths_invoice_id on analytics_payment_auths(invoice_id);
create index analytics_payment_auths_account_id on analytics_payment_auths(account_id);
create index analytics_payment_auths_account_record_id on analytics_payment_auths(account_record_id);
create index analytics_payment_auths_tenant_account_record_id on analytics_payment_auths(tenant_record_id, account_record_id);
create index analytics_payment_auths_cdate_trid_crcy_status_rgroup_camount on analytics_payment_auths(created_date, tenant_record_id, currency, payment_transaction_status, report_group, converted_amount);
create index ap_auths_cdate_trid_crcy_status_rgroup_camount_pname_perror on analytics_payment_auths(created_date, tenant_record_id, currency, payment_transaction_status, report_group, plugin_name );

drop table if exists analytics_payment_captures;
create table analytics_payment_captures (
  record_id serial unique
, invoice_payment_record_id bigint  default null
, invoice_payment_id varchar(36) default null
, invoice_id varchar(36) default null
, invoice_number bigint default null
, invoice_created_date datetime default null
, invoice_date date default null
, invoice_target_date date default null
, invoice_currency varchar(50) default null
, invoice_balance numeric(10, 4) default 0
, converted_invoice_balance numeric(10, 4) default null
, invoice_amount_paid numeric(10, 4) default 0
, converted_invoice_amount_paid numeric(10, 4) default null
, invoice_amount_charged numeric(10, 4) default 0
, converted_invoice_amount_charged numeric(10, 4) default null
, invoice_original_amount_charged numeric(10, 4) default 0
, converted_invoice_original_amount_charged numeric(10, 4) default null
, invoice_amount_credited numeric(10, 4) default 0
, converted_invoice_amount_credited numeric(10, 4) default null
, invoice_amount_refunded numeric(10, 4) default 0
, converted_invoice_amount_refunded numeric(10, 4) default null
, invoice_payment_type varchar(50) default null
, payment_id varchar(36) default null
, refund_id varchar(36) default null
, payment_number bigint default null
, payment_external_key varchar(255) default null
, payment_transaction_id varchar(36) default null
, payment_transaction_external_key varchar(255) default null
, payment_transaction_status varchar(255) default null
, linked_invoice_payment_id varchar(36) default null
, amount numeric(10, 4) default 0
, converted_amount numeric(10, 4) default null
, currency varchar(50) default null
, plugin_name varchar(255) default null
, payment_method_id varchar(36) default null
, payment_method_external_key varchar(255) default null
, plugin_created_date datetime default null
, plugin_effective_date datetime default null
, plugin_status varchar(255) default null
, plugin_gateway_error text default null
, plugin_gateway_error_code varchar(255) default null
, plugin_first_reference_id varchar(255) default null
, plugin_second_reference_id varchar(255) default null
, plugin_property_1 varchar(255) default null
, plugin_property_2 varchar(255) default null
, plugin_property_3 varchar(255) default null
, plugin_property_4 varchar(255) default null
, plugin_property_5 varchar(255) default null
, plugin_pm_id varchar(255) default null
, plugin_pm_is_default bool default null
, plugin_pm_type varchar(255) default null
, plugin_pm_cc_name varchar(255) default null
, plugin_pm_cc_type varchar(255) default null
, plugin_pm_cc_expiration_month varchar(255) default null
, plugin_pm_cc_expiration_year varchar(255) default null
, plugin_pm_cc_last_4 varchar(255) default null
, plugin_pm_address1 varchar(255) default null
, plugin_pm_address2 varchar(255) default null
, plugin_pm_city varchar(255) default null
, plugin_pm_state varchar(255) default null
, plugin_pm_zip varchar(255) default null
, plugin_pm_country varchar(255) default null
, converted_currency varchar(3) default null
, created_date datetime default null
, created_by varchar(50) default null
, created_reason_code varchar(255) default null
, created_comments varchar(255) default null
, account_id varchar(36) default null
, account_name varchar(100) default null
, account_external_key varchar(255) default null
, account_record_id bigint  default null
, tenant_record_id bigint  default null
, report_group varchar(50) not null
, primary key(record_id)
) ;
create index analytics_payment_captures_created_date on analytics_payment_captures(created_date);
create index analytics_payment_captures_date_trid_plugin_name on analytics_payment_captures(created_date, tenant_record_id, plugin_name);
create index analytics_payment_captures_invoice_payment_record_id on analytics_payment_captures(invoice_payment_record_id);
create index analytics_payment_captures_invoice_payment_id on analytics_payment_captures(invoice_payment_id);
create index analytics_payment_captures_invoice_id on analytics_payment_captures(invoice_id);
create index analytics_payment_captures_account_id on analytics_payment_captures(account_id);
create index analytics_payment_captures_account_record_id on analytics_payment_captures(account_record_id);
create index analytics_payment_captures_tenant_account_record_id on analytics_payment_captures(tenant_record_id, account_record_id);
create index analytics_payment_captures_cdate_trid_crcy_status_rgroup_camount on analytics_payment_captures(created_date, tenant_record_id, currency, payment_transaction_status, report_group, converted_amount);
create index ap_captures_cdate_trid_crcy_status_rgroup_camount_pname_perror on analytics_payment_captures(created_date, tenant_record_id, currency, payment_transaction_status, report_group, plugin_name );

drop table if exists analytics_payment_purchases;
create table analytics_payment_purchases (
  record_id serial unique
, invoice_payment_record_id bigint  default null
, invoice_payment_id varchar(36) default null
, invoice_id varchar(36) default null
, invoice_number bigint default null
, invoice_created_date datetime default null
, invoice_date date default null
, invoice_target_date date default null
, invoice_currency varchar(50) default null
, invoice_balance numeric(10, 4) default 0
, converted_invoice_balance numeric(10, 4) default null
, invoice_amount_paid numeric(10, 4) default 0
, converted_invoice_amount_paid numeric(10, 4) default null
, invoice_amount_charged numeric(10, 4) default 0
, converted_invoice_amount_charged numeric(10, 4) default null
, invoice_original_amount_charged numeric(10, 4) default 0
, converted_invoice_original_amount_charged numeric(10, 4) default null
, invoice_amount_credited numeric(10, 4) default 0
, converted_invoice_amount_credited numeric(10, 4) default null
, invoice_amount_refunded numeric(10, 4) default 0
, converted_invoice_amount_refunded numeric(10, 4) default null
, invoice_payment_type varchar(50) default null
, payment_id varchar(36) default null
, refund_id varchar(36) default null
, payment_number bigint default null
, payment_external_key varchar(255) default null
, payment_transaction_id varchar(36) default null
, payment_transaction_external_key varchar(255) default null
, payment_transaction_status varchar(255) default null
, linked_invoice_payment_id varchar(36) default null
, amount numeric(10, 4) default 0
, converted_amount numeric(10, 4) default null
, currency varchar(50) default null
, plugin_name varchar(255) default null
, payment_method_id varchar(36) default null
, payment_method_external_key varchar(255) default null
, plugin_created_date datetime default null
, plugin_effective_date datetime default null
, plugin_status varchar(255) default null
, plugin_gateway_error text default null
, plugin_gateway_error_code varchar(255) default null
, plugin_first_reference_id varchar(255) default null
, plugin_second_reference_id varchar(255) default null
, plugin_property_1 varchar(255) default null
, plugin_property_2 varchar(255) default null
, plugin_property_3 varchar(255) default null
, plugin_property_4 varchar(255) default null
, plugin_property_5 varchar(255) default null
, plugin_pm_id varchar(255) default null
, plugin_pm_is_default bool default null
, plugin_pm_type varchar(255) default null
, plugin_pm_cc_name varchar(255) default null
, plugin_pm_cc_type varchar(255) default null
, plugin_pm_cc_expiration_month varchar(255) default null
, plugin_pm_cc_expiration_year varchar(255) default null
, plugin_pm_cc_last_4 varchar(255) default null
, plugin_pm_address1 varchar(255) default null
, plugin_pm_address2 varchar(255) default null
, plugin_pm_city varchar(255) default null
, plugin_pm_state varchar(255) default null
, plugin_pm_zip varchar(255) default null
, plugin_pm_country varchar(255) default null
, converted_currency varchar(3) default null
, created_date datetime default null
, created_by varchar(50) default null
, created_reason_code varchar(255) default null
, created_comments varchar(255) default null
, account_id varchar(36) default null
, account_name varchar(100) default null
, account_external_key varchar(255) default null
, account_record_id bigint  default null
, tenant_record_id bigint  default null
, report_group varchar(50) not null
, primary key(record_id)
) ;
create index analytics_payment_purchases_created_date on analytics_payment_purchases(created_date);
create index analytics_payment_purchases_date_trid_plugin_name on analytics_payment_purchases(created_date, tenant_record_id, plugin_name);
create index analytics_payment_purchases_invoice_payment_record_id on analytics_payment_purchases(invoice_payment_record_id);
create index analytics_payment_purchases_invoice_payment_id on analytics_payment_purchases(invoice_payment_id);
create index analytics_payment_purchases_invoice_id on analytics_payment_purchases(invoice_id);
create index analytics_payment_purchases_account_id on analytics_payment_purchases(account_id);
create index analytics_payment_purchases_account_record_id on analytics_payment_purchases(account_record_id);
create index analytics_payment_purchases_tenant_account_record_id on analytics_payment_purchases(tenant_record_id, account_record_id);
create index analytics_payment_prchses_cdate_trid_crcy_status_rgroup_camount on analytics_payment_purchases(created_date, tenant_record_id, currency, payment_transaction_status, report_group, converted_amount);
create index ap_prchses_cdate_trid_crcy_status_rgroup_camount_pname_perror on analytics_payment_purchases(created_date, tenant_record_id, currency, payment_transaction_status, report_group, plugin_name );

drop table if exists analytics_payment_refunds;
create table analytics_payment_refunds (
  record_id serial unique
, invoice_payment_record_id bigint  default null
, invoice_payment_id varchar(36) default null
, invoice_id varchar(36) default null
, invoice_number bigint default null
, invoice_created_date datetime default null
, invoice_date date default null
, invoice_target_date date default null
, invoice_currency varchar(50) default null
, invoice_balance numeric(10, 4) default 0
, converted_invoice_balance numeric(10, 4) default null
, invoice_amount_paid numeric(10, 4) default 0
, converted_invoice_amount_paid numeric(10, 4) default null
, invoice_amount_charged numeric(10, 4) default 0
, converted_invoice_amount_charged numeric(10, 4) default null
, invoice_original_amount_charged numeric(10, 4) default 0
, converted_invoice_original_amount_charged numeric(10, 4) default null
, invoice_amount_credited numeric(10, 4) default 0
, converted_invoice_amount_credited numeric(10, 4) default null
, invoice_amount_refunded numeric(10, 4) default 0
, converted_invoice_amount_refunded numeric(10, 4) default null
, invoice_payment_type varchar(50) default null
, payment_id varchar(36) default null
, refund_id varchar(36) default null
, payment_number bigint default null
, payment_external_key varchar(255) default null
, payment_transaction_id varchar(36) default null
, payment_transaction_external_key varchar(255) default null
, payment_transaction_status varchar(255) default null
, linked_invoice_payment_id varchar(36) default null
, amount numeric(10, 4) default 0
, converted_amount numeric(10, 4) default null
, currency varchar(50) default null
, plugin_name varchar(255) default null
, payment_method_id varchar(36) default null
, payment_method_external_key varchar(255) default null
, plugin_created_date datetime default null
, plugin_effective_date datetime default null
, plugin_status varchar(255) default null
, plugin_gateway_error text default null
, plugin_gateway_error_code varchar(255) default null
, plugin_first_reference_id varchar(255) default null
, plugin_second_reference_id varchar(255) default null
, plugin_property_1 varchar(255) default null
, plugin_property_2 varchar(255) default null
, plugin_property_3 varchar(255) default null
, plugin_property_4 varchar(255) default null
, plugin_property_5 varchar(255) default null
, plugin_pm_id varchar(255) default null
, plugin_pm_is_default bool default null
, plugin_pm_type varchar(255) default null
, plugin_pm_cc_name varchar(255) default null
, plugin_pm_cc_type varchar(255) default null
, plugin_pm_cc_expiration_month varchar(255) default null
, plugin_pm_cc_expiration_year varchar(255) default null
, plugin_pm_cc_last_4 varchar(255) default null
, plugin_pm_address1 varchar(255) default null
, plugin_pm_address2 varchar(255) default null
, plugin_pm_city varchar(255) default null
, plugin_pm_state varchar(255) default null
, plugin_pm_zip varchar(255) default null
, plugin_pm_country varchar(255) default null
, converted_currency varchar(3) default null
, created_date datetime default null
, created_by varchar(50) default null
, created_reason_code varchar(255) default null
, created_comments varchar(255) default null
, account_id varchar(36) default null
, account_name varchar(100) default null
, account_external_key varchar(255) default null
, account_record_id bigint  default null
, tenant_record_id bigint  default null
, report_group varchar(50) not null
, primary key(record_id)
) ;
create index analytics_payment_refunds_created_date on analytics_payment_refunds(created_date);
create index analytics_payment_refunds_date_trid_plugin_name on analytics_payment_refunds(created_date, tenant_record_id, plugin_name);
create index analytics_payment_refunds_invoice_payment_record_id on analytics_payment_refunds(invoice_payment_record_id);
create index analytics_payment_refunds_invoice_payment_id on analytics_payment_refunds(invoice_payment_id);
create index analytics_payment_refunds_invoice_id on analytics_payment_refunds(invoice_id);
create index analytics_payment_refunds_account_id on analytics_payment_refunds(account_id);
create index analytics_payment_refunds_account_record_id on analytics_payment_refunds(account_record_id);
create index analytics_payment_refunds_tenant_account_record_id on analytics_payment_refunds(tenant_record_id, account_record_id);
create index analytics_payment_refunds_cdate_trid_crcy_status_rgroup_camount on analytics_payment_refunds(created_date, tenant_record_id, currency, payment_transaction_status, report_group, converted_amount);
create index ap_refunds_cdate_trid_crcy_status_rgroup_camount_pname_perror on analytics_payment_refunds(created_date, tenant_record_id, currency, payment_transaction_status, report_group, plugin_name );

drop table if exists analytics_payment_credits;
create table analytics_payment_credits (
  record_id serial unique
, invoice_payment_record_id bigint  default null
, invoice_payment_id varchar(36) default null
, invoice_id varchar(36) default null
, invoice_number bigint default null
, invoice_created_date datetime default null
, invoice_date date default null
, invoice_target_date date default null
, invoice_currency varchar(50) default null
, invoice_balance numeric(10, 4) default 0
, converted_invoice_balance numeric(10, 4) default null
, invoice_amount_paid numeric(10, 4) default 0
, converted_invoice_amount_paid numeric(10, 4) default null
, invoice_amount_charged numeric(10, 4) default 0
, converted_invoice_amount_charged numeric(10, 4) default null
, invoice_original_amount_charged numeric(10, 4) default 0
, converted_invoice_original_amount_charged numeric(10, 4) default null
, invoice_amount_credited numeric(10, 4) default 0
, converted_invoice_amount_credited numeric(10, 4) default null
, invoice_amount_refunded numeric(10, 4) default 0
, converted_invoice_amount_refunded numeric(10, 4) default null
, invoice_payment_type varchar(50) default null
, payment_id varchar(36) default null
, refund_id varchar(36) default null
, payment_number bigint default null
, payment_external_key varchar(255) default null
, payment_transaction_id varchar(36) default null
, payment_transaction_external_key varchar(255) default null
, payment_transaction_status varchar(255) default null
, linked_invoice_payment_id varchar(36) default null
, amount numeric(10, 4) default 0
, converted_amount numeric(10, 4) default null
, currency varchar(50) default null
, plugin_name varchar(255) default null
, payment_method_id varchar(36) default null
, payment_method_external_key varchar(255) default null
, plugin_created_date datetime default null
, plugin_effective_date datetime default null
, plugin_status varchar(255) default null
, plugin_gateway_error text default null
, plugin_gateway_error_code varchar(255) default null
, plugin_first_reference_id varchar(255) default null
, plugin_second_reference_id varchar(255) default null
, plugin_property_1 varchar(255) default null
, plugin_property_2 varchar(255) default null
, plugin_property_3 varchar(255) default null
, plugin_property_4 varchar(255) default null
, plugin_property_5 varchar(255) default null
, plugin_pm_id varchar(255) default null
, plugin_pm_is_default bool default null
, plugin_pm_type varchar(255) default null
, plugin_pm_cc_name varchar(255) default null
, plugin_pm_cc_type varchar(255) default null
, plugin_pm_cc_expiration_month varchar(255) default null
, plugin_pm_cc_expiration_year varchar(255) default null
, plugin_pm_cc_last_4 varchar(255) default null
, plugin_pm_address1 varchar(255) default null
, plugin_pm_address2 varchar(255) default null
, plugin_pm_city varchar(255) default null
, plugin_pm_state varchar(255) default null
, plugin_pm_zip varchar(255) default null
, plugin_pm_country varchar(255) default null
, converted_currency varchar(3) default null
, created_date datetime default null
, created_by varchar(50) default null
, created_reason_code varchar(255) default null
, created_comments varchar(255) default null
, account_id varchar(36) default null
, account_name varchar(100) default null
, account_external_key varchar(255) default null
, account_record_id bigint  default null
, tenant_record_id bigint  default null
, report_group varchar(50) not null
, primary key(record_id)
) ;
create index analytics_payment_credits_created_date on analytics_payment_credits(created_date);
create index analytics_payment_credits_date_trid_plugin_name on analytics_payment_credits(created_date, tenant_record_id, plugin_name);
create index analytics_payment_credits_invoice_payment_record_id on analytics_payment_credits(invoice_payment_record_id);
create index analytics_payment_credits_invoice_payment_id on analytics_payment_credits(invoice_payment_id);
create index analytics_payment_credits_invoice_id on analytics_payment_credits(invoice_id);
create index analytics_payment_credits_account_id on analytics_payment_credits(account_id);
create index analytics_payment_credits_account_record_id on analytics_payment_credits(account_record_id);
create index analytics_payment_credits_tenant_account_record_id on analytics_payment_credits(tenant_record_id, account_record_id);
create index analytics_payment_credits_cdate_trid_crcy_status_rgroup_camount on analytics_payment_credits(created_date, tenant_record_id, currency, payment_transaction_status, report_group, converted_amount);
create index ap_credits_cdate_trid_crcy_status_rgroup_camount_pname_perror on analytics_payment_credits(created_date, tenant_record_id, currency, payment_transaction_status, report_group, plugin_name );

drop table if exists analytics_payment_chargebacks;
create table analytics_payment_chargebacks (
  record_id serial unique
, invoice_payment_record_id bigint  default null
, invoice_payment_id varchar(36) default null
, invoice_id varchar(36) default null
, invoice_number bigint default null
, invoice_created_date datetime default null
, invoice_date date default null
, invoice_target_date date default null
, invoice_currency varchar(50) default null
, invoice_balance numeric(10, 4) default 0
, converted_invoice_balance numeric(10, 4) default null
, invoice_amount_paid numeric(10, 4) default 0
, converted_invoice_amount_paid numeric(10, 4) default null
, invoice_amount_charged numeric(10, 4) default 0
, converted_invoice_amount_charged numeric(10, 4) default null
, invoice_original_amount_charged numeric(10, 4) default 0
, converted_invoice_original_amount_charged numeric(10, 4) default null
, invoice_amount_credited numeric(10, 4) default 0
, converted_invoice_amount_credited numeric(10, 4) default null
, invoice_amount_refunded numeric(10, 4) default 0
, converted_invoice_amount_refunded numeric(10, 4) default null
, invoice_payment_type varchar(50) default null
, payment_id varchar(36) default null
, refund_id varchar(36) default null
, payment_number bigint default null
, payment_external_key varchar(255) default null
, payment_transaction_id varchar(36) default null
, payment_transaction_external_key varchar(255) default null
, payment_transaction_status varchar(255) default null
, linked_invoice_payment_id varchar(36) default null
, amount numeric(10, 4) default 0
, converted_amount numeric(10, 4) default null
, currency varchar(50) default null
, plugin_name varchar(255) default null
, payment_method_id varchar(36) default null
, payment_method_external_key varchar(255) default null
, plugin_created_date datetime default null
, plugin_effective_date datetime default null
, plugin_status varchar(255) default null
, plugin_gateway_error text default null
, plugin_gateway_error_code varchar(255) default null
, plugin_first_reference_id varchar(255) default null
, plugin_second_reference_id varchar(255) default null
, plugin_property_1 varchar(255) default null
, plugin_property_2 varchar(255) default null
, plugin_property_3 varchar(255) default null
, plugin_property_4 varchar(255) default null
, plugin_property_5 varchar(255) default null
, plugin_pm_id varchar(255) default null
, plugin_pm_is_default bool default null
, plugin_pm_type varchar(255) default null
, plugin_pm_cc_name varchar(255) default null
, plugin_pm_cc_type varchar(255) default null
, plugin_pm_cc_expiration_month varchar(255) default null
, plugin_pm_cc_expiration_year varchar(255) default null
, plugin_pm_cc_last_4 varchar(255) default null
, plugin_pm_address1 varchar(255) default null
, plugin_pm_address2 varchar(255) default null
, plugin_pm_city varchar(255) default null
, plugin_pm_state varchar(255) default null
, plugin_pm_zip varchar(255) default null
, plugin_pm_country varchar(255) default null
, converted_currency varchar(3) default null
, created_date datetime default null
, created_by varchar(50) default null
, created_reason_code varchar(255) default null
, created_comments varchar(255) default null
, account_id varchar(36) default null
, account_name varchar(100) default null
, account_external_key varchar(255) default null
, account_record_id bigint  default null
, tenant_record_id bigint  default null
, report_group varchar(50) not null
, primary key(record_id)
) ;
create index analytics_payment_chargebacks_created_date on analytics_payment_chargebacks(created_date);
create index analytics_payment_chargebacks_date_trid_plugin_name on analytics_payment_chargebacks(created_date, tenant_record_id, plugin_name);
create index analytics_payment_chargebacks_invoice_payment_record_id on analytics_payment_chargebacks(invoice_payment_record_id);
create index analytics_payment_chargebacks_invoice_payment_id on analytics_payment_chargebacks(invoice_payment_id);
create index analytics_payment_chargebacks_invoice_id on analytics_payment_chargebacks(invoice_id);
create index analytics_payment_chargebacks_account_id on analytics_payment_chargebacks(account_id);
create index analytics_payment_chargebacks_account_record_id on analytics_payment_chargebacks(account_record_id);
create index analytics_payment_chargebacks_tenant_account_record_id on analytics_payment_chargebacks(tenant_record_id, account_record_id);
create index analytics_payment_cbacks_cdate_trid_crcy_status_rgroup_camount on analytics_payment_chargebacks(created_date, tenant_record_id, currency, payment_transaction_status, report_group, converted_amount);
create index ap_cbacks_cdate_trid_crcy_status_rgroup_camount_pname_perror on analytics_payment_chargebacks(created_date, tenant_record_id, currency, payment_transaction_status, report_group, plugin_name );

drop table if exists analytics_payment_voids;
create table analytics_payment_voids (
  record_id serial unique
, invoice_payment_record_id bigint  default null
, invoice_payment_id varchar(36) default null
, invoice_id varchar(36) default null
, invoice_number bigint default null
, invoice_created_date datetime default null
, invoice_date date default null
, invoice_target_date date default null
, invoice_currency varchar(50) default null
, invoice_balance numeric(10, 4) default 0
, converted_invoice_balance numeric(10, 4) default null
, invoice_amount_paid numeric(10, 4) default 0
, converted_invoice_amount_paid numeric(10, 4) default null
, invoice_amount_charged numeric(10, 4) default 0
, converted_invoice_amount_charged numeric(10, 4) default null
, invoice_original_amount_charged numeric(10, 4) default 0
, converted_invoice_original_amount_charged numeric(10, 4) default null
, invoice_amount_credited numeric(10, 4) default 0
, converted_invoice_amount_credited numeric(10, 4) default null
, invoice_amount_refunded numeric(10, 4) default 0
, converted_invoice_amount_refunded numeric(10, 4) default null
, invoice_payment_type varchar(50) default null
, payment_id varchar(36) default null
, refund_id varchar(36) default null
, payment_number bigint default null
, payment_external_key varchar(255) default null
, payment_transaction_id varchar(36) default null
, payment_transaction_external_key varchar(255) default null
, payment_transaction_status varchar(255) default null
, linked_invoice_payment_id varchar(36) default null
, amount numeric(10, 4) default 0
, converted_amount numeric(10, 4) default null
, currency varchar(50) default null
, plugin_name varchar(255) default null
, payment_method_id varchar(36) default null
, payment_method_external_key varchar(255) default null
, plugin_created_date datetime default null
, plugin_effective_date datetime default null
, plugin_status varchar(255) default null
, plugin_gateway_error text default null
, plugin_gateway_error_code varchar(255) default null
, plugin_first_reference_id varchar(255) default null
, plugin_second_reference_id varchar(255) default null
, plugin_property_1 varchar(255) default null
, plugin_property_2 varchar(255) default null
, plugin_property_3 varchar(255) default null
, plugin_property_4 varchar(255) default null
, plugin_property_5 varchar(255) default null
, plugin_pm_id varchar(255) default null
, plugin_pm_is_default bool default null
, plugin_pm_type varchar(255) default null
, plugin_pm_cc_name varchar(255) default null
, plugin_pm_cc_type varchar(255) default null
, plugin_pm_cc_expiration_month varchar(255) default null
, plugin_pm_cc_expiration_year varchar(255) default null
, plugin_pm_cc_last_4 varchar(255) default null
, plugin_pm_address1 varchar(255) default null
, plugin_pm_address2 varchar(255) default null
, plugin_pm_city varchar(255) default null
, plugin_pm_state varchar(255) default null
, plugin_pm_zip varchar(255) default null
, plugin_pm_country varchar(255) default null
, converted_currency varchar(3) default null
, created_date datetime default null
, created_by varchar(50) default null
, created_reason_code varchar(255) default null
, created_comments varchar(255) default null
, account_id varchar(36) default null
, account_name varchar(100) default null
, account_external_key varchar(255) default null
, account_record_id bigint  default null
, tenant_record_id bigint  default null
, report_group varchar(50) not null
, primary key(record_id)
) ;
create index analytics_payment_voids_created_date on analytics_payment_voids(created_date);
create index analytics_payment_voids_date_trid_plugin_name on analytics_payment_voids(created_date, tenant_record_id, plugin_name);
create index analytics_payment_voids_invoice_payment_record_id on analytics_payment_voids(invoice_payment_record_id);
create index analytics_payment_voids_invoice_payment_id on analytics_payment_voids(invoice_payment_id);
create index analytics_payment_voids_invoice_id on analytics_payment_voids(invoice_id);
create index analytics_payment_voids_account_id on analytics_payment_voids(account_id);
create index analytics_payment_voids_account_record_id on analytics_payment_voids(account_record_id);
create index analytics_payment_voids_tenant_account_record_id on analytics_payment_voids(tenant_record_id, account_record_id);
create index analytics_payment_voids_cdate_trid_crcy_status_rgroup_camount on analytics_payment_voids(created_date, tenant_record_id, currency, payment_transaction_status, report_group, converted_amount);
create index ap_voids_cdate_trid_crcy_status_rgroup_camount_pname_perror on analytics_payment_voids(created_date, tenant_record_id, currency, payment_transaction_status, report_group, plugin_name );

-- Tags

drop table if exists analytics_account_tags;
create table analytics_account_tags (
  record_id serial unique
, tag_record_id bigint  default null
, name varchar(50) default null
, created_date datetime default null
, created_by varchar(50) default null
, created_reason_code varchar(255) default null
, created_comments varchar(255) default null
, account_id varchar(36) default null
, account_name varchar(100) default null
, account_external_key varchar(255) default null
, account_record_id bigint  default null
, tenant_record_id bigint  default null
, report_group varchar(50) not null
, primary key(record_id)
) ;
create index analytics_account_tags_account_id on analytics_account_tags(account_id);
create index analytics_account_tags_account_record_id on analytics_account_tags(account_record_id);
create index analytics_account_tags_tenant_account_record_id on analytics_account_tags(tenant_record_id, account_record_id);

drop table if exists analytics_bundle_tags;
create table analytics_bundle_tags (
  record_id serial unique
, tag_record_id bigint  default null
, bundle_id varchar(36) default null
, bundle_external_key varchar(255) default null
, name varchar(50) default null
, created_date datetime default null
, created_by varchar(50) default null
, created_reason_code varchar(255) default null
, created_comments varchar(255) default null
, account_id varchar(36) default null
, account_name varchar(100) default null
, account_external_key varchar(255) default null
, account_record_id bigint  default null
, tenant_record_id bigint  default null
, report_group varchar(50) not null
, primary key(record_id)
) ;
create index analytics_bundle_tags_account_id on analytics_bundle_tags(account_id);
create index analytics_bundle_tags_bundle_id on analytics_bundle_tags(bundle_id);
create index analytics_bundle_tags_bundle_external_key on analytics_bundle_tags(bundle_external_key);
create index analytics_bundle_tags_account_record_id on analytics_bundle_tags(account_record_id);
create index analytics_bundle_tags_tenant_account_record_id on analytics_bundle_tags(tenant_record_id, account_record_id);

drop table if exists analytics_invoice_tags;
create table analytics_invoice_tags (
  record_id serial unique
, tag_record_id bigint  default null
, invoice_id varchar(36) default null
, name varchar(50) default null
, created_date datetime default null
, created_by varchar(50) default null
, created_reason_code varchar(255) default null
, created_comments varchar(255) default null
, account_id varchar(36) default null
, account_name varchar(100) default null
, account_external_key varchar(255) default null
, account_record_id bigint  default null
, tenant_record_id bigint  default null
, report_group varchar(50) not null
, primary key(record_id)
) ;
create index analytics_invoice_tags_account_id on analytics_invoice_tags(account_id);
create index analytics_invoice_tags_account_record_id on analytics_invoice_tags(account_record_id);
create index analytics_invoice_tags_tenant_account_record_id on analytics_invoice_tags(tenant_record_id, account_record_id);

drop table if exists analytics_payment_tags;
create table analytics_payment_tags (
  record_id serial unique
, tag_record_id bigint  default null
, invoice_payment_id varchar(36) default null
, name varchar(50) default null
, created_date datetime default null
, created_by varchar(50) default null
, created_reason_code varchar(255) default null
, created_comments varchar(255) default null
, account_id varchar(36) default null
, account_name varchar(100) default null
, account_external_key varchar(255) default null
, account_record_id bigint  default null
, tenant_record_id bigint  default null
, report_group varchar(50) not null
, primary key(record_id)
) ;
create index analytics_payment_tags_account_id on analytics_payment_tags(account_id);
create index analytics_payment_tags_account_record_id on analytics_payment_tags(account_record_id);
create index analytics_payment_tags_tenant_account_record_id on analytics_payment_tags(tenant_record_id, account_record_id);

drop table if exists analytics_account_fields;
create table analytics_account_fields (
  record_id serial unique
, custom_field_record_id bigint  default null
, name varchar(64) default null
, value varchar(255) default null
, created_date datetime default null
, created_by varchar(50) default null
, created_reason_code varchar(255) default null
, created_comments varchar(255) default null
, account_id varchar(36) default null
, account_name varchar(100) default null
, account_external_key varchar(255) default null
, account_record_id bigint  default null
, tenant_record_id bigint  default null
, report_group varchar(50) not null
, primary key(record_id)
) ;
create index analytics_account_fields_account_id on analytics_account_fields(account_id);
create index analytics_account_fields_account_record_id on analytics_account_fields(account_record_id);
create index analytics_account_fields_tenant_account_record_id on analytics_account_fields(tenant_record_id, account_record_id);

drop table if exists analytics_bundle_fields;
create table analytics_bundle_fields (
  record_id serial unique
, custom_field_record_id bigint  default null
, bundle_id varchar(36) default null
, bundle_external_key varchar(255) default null
, name varchar(64) default null
, value varchar(255) default null
, created_date datetime default null
, created_by varchar(50) default null
, created_reason_code varchar(255) default null
, created_comments varchar(255) default null
, account_id varchar(36) default null
, account_name varchar(100) default null
, account_external_key varchar(255) default null
, account_record_id bigint  default null
, tenant_record_id bigint  default null
, report_group varchar(50) not null
, primary key(record_id)
) ;
create index analytics_bundle_fields_account_id on analytics_bundle_fields(account_id);
create index analytics_bundle_fields_bundle_id on analytics_bundle_fields(bundle_id);
create index analytics_bundle_fields_bundle_external_key on analytics_bundle_fields(bundle_external_key);
create index analytics_bundle_fields_account_record_id on analytics_bundle_fields(account_record_id);
create index analytics_bundle_fields_tenant_account_record_id on analytics_bundle_fields(tenant_record_id, account_record_id);

drop table if exists analytics_invoice_fields;
create table analytics_invoice_fields (
  record_id serial unique
, custom_field_record_id bigint  default null
, invoice_id varchar(36) default null
, name varchar(64) default null
, value varchar(255) default null
, created_date datetime default null
, created_by varchar(50) default null
, created_reason_code varchar(255) default null
, created_comments varchar(255) default null
, account_id varchar(36) default null
, account_name varchar(100) default null
, account_external_key varchar(255) default null
, account_record_id bigint  default null
, tenant_record_id bigint  default null
, report_group varchar(50) not null
, primary key(record_id)
) ;
create index analytics_invoice_fields_account_id on analytics_invoice_fields(account_id);
create index analytics_invoice_fields_account_record_id on analytics_invoice_fields(account_record_id);
create index analytics_invoice_fields_tenant_account_record_id on analytics_invoice_fields(tenant_record_id, account_record_id);

drop table if exists analytics_invoice_payment_fields;
create table analytics_invoice_payment_fields (
  record_id serial unique
, custom_field_record_id bigint  default null
, invoice_payment_id varchar(36) default null
, name varchar(64) default null
, value varchar(255) default null
, created_date datetime default null
, created_by varchar(50) default null
, created_reason_code varchar(255) default null
, created_comments varchar(255) default null
, account_id varchar(36) default null
, account_name varchar(100) default null
, account_external_key varchar(255) default null
, account_record_id bigint  default null
, tenant_record_id bigint  default null
, report_group varchar(50) not null
, primary key(record_id)
) ;
create index analytics_invoice_payment_fields_account_id on analytics_invoice_payment_fields(account_id);
create index analytics_invoice_payment_fields_account_record_id on analytics_invoice_payment_fields(account_record_id);
create index analytics_invoice_payment_fields_tenant_account_record_id on analytics_invoice_payment_fields(tenant_record_id, account_record_id);

drop table if exists analytics_payment_fields;
create table analytics_payment_fields (
  record_id serial unique
, custom_field_record_id bigint  default null
, payment_id varchar(36) default null
, name varchar(64) default null
, value varchar(255) default null
, created_date datetime default null
, created_by varchar(50) default null
, created_reason_code varchar(255) default null
, created_comments varchar(255) default null
, account_id varchar(36) default null
, account_name varchar(100) default null
, account_external_key varchar(255) default null
, account_record_id bigint  default null
, tenant_record_id bigint  default null
, report_group varchar(50) not null
, primary key(record_id)
) ;
create index analytics_payment_fields_account_id on analytics_payment_fields(account_id);
create index analytics_payment_fields_account_record_id on analytics_payment_fields(account_record_id);
create index analytics_payment_fields_tenant_account_record_id on analytics_payment_fields(tenant_record_id, account_record_id);

drop table if exists analytics_payment_method_fields;
create table analytics_payment_method_fields (
  record_id serial unique
, custom_field_record_id bigint  default null
, payment_method_id varchar(36) default null
, name varchar(64) default null
, value varchar(255) default null
, created_date datetime default null
, created_by varchar(50) default null
, created_reason_code varchar(255) default null
, created_comments varchar(255) default null
, account_id varchar(36) default null
, account_name varchar(100) default null
, account_external_key varchar(255) default null
, account_record_id bigint  default null
, tenant_record_id bigint  default null
, report_group varchar(50) not null
, primary key(record_id)
) ;
create index analytics_payment_method_fields_account_id on analytics_payment_method_fields(account_id);
create index analytics_payment_method_fields_account_record_id on analytics_payment_method_fields(account_record_id);
create index analytics_payment_method_fields_tenant_account_record_id on analytics_payment_method_fields(tenant_record_id, account_record_id);

drop table if exists analytics_transaction_fields;
create table analytics_transaction_fields (
  record_id serial unique
, custom_field_record_id bigint  default null
, transaction_id varchar(36) default null
, name varchar(64) default null
, value varchar(255) default null
, created_date datetime default null
, created_by varchar(50) default null
, created_reason_code varchar(255) default null
, created_comments varchar(255) default null
, account_id varchar(36) default null
, account_name varchar(100) default null
, account_external_key varchar(255) default null
, account_record_id bigint  default null
, tenant_record_id bigint  default null
, report_group varchar(50) not null
, primary key(record_id)
) ;
create index analytics_transaction_fields_account_id on analytics_transaction_fields(account_id);
create index analytics_transaction_fields_account_record_id on analytics_transaction_fields(account_record_id);
create index analytics_transaction_fields_tenant_account_record_id on analytics_transaction_fields(tenant_record_id, account_record_id);

drop table if exists analytics_notifications;
create table analytics_notifications (
  record_id serial unique
, class_name varchar(256) not null
, event_json varchar(2048) not null
, user_token varchar(36)
, created_date datetime not null
, creating_owner varchar(50) not null
, processing_owner varchar(50) default null
, processing_available_date datetime default null
, processing_state varchar(14) default 'AVAILABLE'
, error_count int  DEFAULT 0
, search_key1 int  default null
, search_key2 int  default null
, queue_name varchar(64) not null
, effective_date datetime not null
, future_user_token varchar(36)
, primary key(record_id)
) ;
create index analytics_notifications_comp_where on analytics_notifications(effective_date, processing_state, processing_owner, processing_available_date);
create index analytics_notifications_update on analytics_notifications(processing_state,processing_owner,processing_available_date);
create index analytics_notifications_get_ready on analytics_notifications(effective_date,created_date);
create index analytics_notifications_search_keys on analytics_notifications(search_key2, search_key1);

drop table if exists analytics_notifications_history;
create table analytics_notifications_history (
  record_id serial unique
, class_name varchar(256) not null
, event_json varchar(2048) not null
, user_token varchar(36)
, created_date datetime not null
, creating_owner varchar(50) not null
, processing_owner varchar(50) default null
, processing_available_date datetime default null
, processing_state varchar(14) default 'AVAILABLE'
, error_count int  DEFAULT 0
, search_key1 int  default null
, search_key2 int  default null
, queue_name varchar(64) not null
, effective_date datetime not null
, future_user_token varchar(36)
, primary key(record_id)
) ;

drop table if exists analytics_currency_conversion;
create table analytics_currency_conversion (
  record_id serial unique
, currency varchar(3) not null
, start_date date not null
, end_date date not null
, reference_rate decimal(10, 4) not null
, reference_currency varchar(3) default 'USD'
, primary key(record_id)
) ;
create index analytics_currency_conversion_dates_currencies on analytics_currency_conversion(start_date, end_date, currency, reference_currency);

drop table if exists analytics_reports;
create table analytics_reports (
  record_id serial unique
, report_name varchar(100) not null
, report_pretty_name varchar(256) default null
, report_type varchar(24) not null default 'TIMELINE'
, source_table_name varchar(256) not null
, refresh_procedure_name varchar(256) default null
, refresh_frequency varchar(50) default null
, refresh_hour_of_day_gmt smallint default null
, primary key(record_id)
) ;
create unique index analytics_reports_report_name on analytics_reports(report_name);

-- PLUGIN DDL -> analytics-plugin -> calendar.sql
drop procedure if exists create_calendar;

delimiter //
create procedure create_calendar(calendar_from date, calendar_to date)
begin
  declare d date;
  set d = calendar_from;

  drop table if exists calendar;
  create table calendar(d date primary key);
  while d <= calendar_to do
    insert into calendar(d) values (d);
    set d = date_add(d, interval 1 day);
  end while;
end//

delimiter ;
call create_calendar(date_sub(date_format(now(), '%Y-%m-%d'), interval 5 year), date_add(date_format(now(), '%Y-%m-%d'), interval 10 year));

-- PLUGIN DDL -> analytics-plugin -> system_report_notifications_per_queue_name.sql
create or replace view v_system_report_notifications_per_queue_name as
select
  search_key2 as tenant_record_id
, queue_name
, date_format(effective_date, '%Y-%m-%d') as day
, count(*) as count
from notifications
where processing_state = 'AVAILABLE'
group by 1, 2, 3
order by 1, 2, 3 asc
;

-- PLUGIN DDL -> analytics-plugin -> system_report_control_tag_no_test.sql
create or replace view v_system_report_control_tag_no_test as
select
  a1.tenant_record_id
, a1.name as tag_name
, count(distinct(a1.account_id)) as count
from analytics_account_tags a1
left outer join analytics_account_tags a2
on a1.account_id = a2.account_id and a2.name = 'TEST'
where 1=1
and a2.record_id IS NULL
and a1.name IN ('OVERDUE_ENFORCEMENT_OFF', 'AUTO_PAY_OFF', 'AUTO_INVOICING_OFF', 'MANUAL_PAY', 'PARTNER')
group by 1, 2
;

-- PLUGIN DDL -> analytics-plugin -> system_report_payments.sql
create or replace view v_system_report_payments as
select
  tenant_record_id
, state_name as label
, count(*) as count
from payments
group by 1, 2
;

-- PLUGIN DDL -> analytics-plugin -> system_report_payments_per_day.sql
create or replace view v_system_report_payments_per_day as
select
  tenant_record_id
, date_format(greatest(created_date, updated_date), '%Y-%m-%d') as day
, case
    when state_name IN ('AUTH_ERRORED', 'CAPTURE_ERRORED', 'CHARGEBACK_ERRORED', 'CREDIT_ERRORED', 'PURCHASE_ERRORED', 'REFUND_ERRORED', 'VOID_ERRORED') then 'ERRORED'
    when state_name IN ('AUTH_FAILED', 'CAPTURE_FAILED', 'CHARGEBACK_FAILED', 'CREDIT_FAILED', 'PURCHASE_FAILED', 'REFUND_FAILED', 'VOID_FAILED') then 'FAILED'
    when state_name IN ('AUTH_PENDING', 'CAPTURE_PENDING', 'CHARGEBACK_PENDING', 'CREDIT_PENDING', 'PURCHASE_PENDING', 'REFUND_PENDING', 'VOID_PENDING') then 'PENDING'
    when state_name IN ('AUTH_SUCCESS', 'CAPTURE_SUCCESS', 'CHARGEBACK_SUCCESS', 'CREDIT_SUCCESS', 'PURCHASE_SUCCESS', 'REFUND_SUCCESS', 'VOID_SUCCESS') then 'SUCCESS'
    else 'OTHER'
  end as payment_status
, count(*)  as count
from payments
group by 1, 2, 3
order by 1, 2, 3  asc
;

-- PLUGIN DDL -> analytics-plugin -> system_report_notifications_per_queue_name_late.sql
create or replace view v_system_report_notifications_per_queue_name_late as
select
  search_key2 as tenant_record_id
, queue_name as label
, count(*) as count
from notifications
where 1=1
and processing_state = 'AVAILABLE'
and effective_date < NOW()
-- and (processing_owner IS NULL OR processing_available_date <= NOW())
group by 1, 2
order by 1, 2 asc
;

-- PLUGIN DDL -> analytics-plugin -> v_report_invoice_item_credits_daily.ddl
create or replace view v_report_invoice_credits_daily as
select
  aic.tenant_record_id
, aic.currency
, date_format(aic.created_date,'%Y-%m-%d') as day
, sum(aic.amount) as count
from
  analytics_invoice_credits aic
where 1=1
  and aic.report_group='default'
group by 1,2,3
;

-- PLUGIN DDL -> analytics-plugin -> v_report_trial_starts_count_daily.ddl
create or replace view v_report_trial_starts_count_daily as
select
  ast.tenant_record_id
, ast.next_start_date as day
, ast.next_product_name as product
, count(1) as count
from
  analytics_subscription_transitions ast
where 1=1
  and ast.report_group='default'
  and ast.prev_phase is null
  and ast.next_phase='TRIAL'
  and ast.next_start_date IS NOT NULL
  and ast.event='START_ENTITLEMENT_BASE'
group by 1,2,3
;


-- PLUGIN DDL -> analytics-plugin -> v_report_invoice_item_adjustments_daily.ddl
create or replace view v_report_invoice_item_adjustments_daily as
select
  aiia.tenant_record_id
, aiia.currency
, date_format(aiia.created_date,'%Y-%m-%d') as day
, sum(aiia.converted_amount) as count
from
  analytics_invoice_item_adjustments aiia
where 1=1
  and aiia.report_group='default'
group by 1,2,3
;

-- PLUGIN DDL -> analytics-plugin -> v_report_invoice_adjustments_daily.ddl
create or replace view v_report_invoice_adjustments_daily as
select
  aia.tenant_record_id
, aia.currency
, date_format(aia.created_date,'%Y-%m-%d') as day
, sum(aia.converted_amount) as count
from
  analytics_invoice_adjustments aia
where 1=1
  and aia.report_group='default'
group by 1,2,3
;

-- PLUGIN DDL -> analytics-plugin -> v_report_conversions_daily.ddl
create or replace view v_report_conversions_daily as
select
  ast.tenant_record_id
, date_format(ast.next_start_date,'%Y-%m-%d') as day
, count(0) as count
from
  analytics_subscription_transitions ast
where 1=1
  and ast.prev_phase='TRIAL'
  and ast.next_phase!='TRIAL'
  and ast.report_group='default'
group by 1,2
;

-- PLUGIN DDL -> analytics-plugin -> v_report_overdue_states_count_daily.ddl
create or replace view v_report_overdue_states_count_daily as
select
  aat.tenant_record_id
, aat.state
, date_format(cal.d,'%Y-%m-%d') as day
, count(1) as count
from
  calendar cal
  join analytics_account_transitions aat on date_format(aat.start_date, '%Y-%m-%d')=date_format(cal.d, '%Y-%m-%d')
where 1=1
  and aat.report_group='default'
  and aat.service='overdue-service'
  and cal.d <= now()
group by 1,2,3
;

-- PLUGIN DDL -> analytics-plugin -> v_report_new_accounts_daily.ddl
create or replace view v_report_new_accounts_daily as
select
  aa.tenant_record_id
, date_format(aa.created_date,'%Y-%m-%d') as day
, count(0) as count
from
  analytics_accounts aa
where 1=1
  and aa.report_group='default'
group by 1,2
;

-- PLUGIN DDL -> analytics-plugin -> report_new_accounts_daily.ddl
create table report_new_accounts_daily as select * from v_report_new_accounts_daily limit 0;

drop procedure if exists refresh_report_new_accounts_daily;
DELIMITER //
CREATE PROCEDURE refresh_report_new_accounts_daily()
BEGIN

DECLARE EXIT HANDLER FOR SQLEXCEPTION ROLLBACK;
DECLARE EXIT HANDLER FOR SQLWARNING ROLLBACK;

SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
START TRANSACTION;
  delete from report_new_accounts_daily;
  insert into report_new_accounts_daily select * from v_report_new_accounts_daily;
COMMIT;

END;
//
DELIMITER ;

-- PLUGIN DDL -> analytics-plugin -> v_report_active_by_product_term_monthly.ddl
create or replace view v_report_active_by_product_term_monthly as
select
  tenant_record_id
, cal.d as day
, next_product_name product_name
, next_billing_period billing_period
, count(1) count
from
  analytics_subscription_transitions ast
  join calendar cal on next_start_date < cal.d and (next_end_date > cal.d or next_end_date is null ) and (cal.d = last_day(cal.d) or cal.d = cast(date_format(now(), '%Y-%m-%d') as date))
where 1=1
  and event in ('START_ENTITLEMENT_BASE','CHANGE_BASE','SYSTEM_CHANGE_BASE')
  and next_service = 'entitlement-service'
  and cal.d < sysdate()
  and next_mrr > 0
  and report_group = 'default'
group by 1,2,3,4
;

-- PLUGIN DDL -> analytics-plugin -> report_active_by_product_term_monthly.ddl
create table report_active_by_product_term_monthly as select * from v_report_active_by_product_term_monthly limit 0;

drop procedure if exists refresh_report_active_by_product_term_monthly;
DELIMITER //
CREATE PROCEDURE refresh_report_active_by_product_term_monthly()
BEGIN

DECLARE EXIT HANDLER FOR SQLEXCEPTION ROLLBACK;
DECLARE EXIT HANDLER FOR SQLWARNING ROLLBACK;

SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
START TRANSACTION;
  delete from report_active_by_product_term_monthly;
  insert into report_active_by_product_term_monthly
  select
    x.tenant_record_id
  , cal.d day
  , x.product_name
  , x.billing_period
  , x.count
  from calendar cal
  join (
    select
      tenant_record_id
    , last_day(day) day
    , product_name
    , billing_period
    , count
    from
      v_report_active_by_product_term_monthly
    where 1=1
  ) x on last_day(cal.d) = x.day
  where 1=1
  ;
COMMIT;

END;
//
DELIMITER ;

-- PLUGIN DDL -> analytics-plugin -> v_report_chargebacks_daily.ddl
create or replace view v_report_chargebacks_daily as
select
  ac.tenant_record_id
, date_format(ac.created_date,'%Y-%m-%d') as day
, ac.currency
, sum(ac.converted_amount) as count
from
  analytics_payment_chargebacks ac
where 1=1
  and ac.report_group='default'
group by 1,2,3
;

-- PLUGIN DDL -> analytics-plugin -> report_chargebacks_daily.ddl
create table report_chargebacks_daily as select * from v_report_chargebacks_daily limit 0;

drop procedure if exists refresh_report_chargebacks_daily;
DELIMITER //
CREATE PROCEDURE refresh_report_chargebacks_daily()
BEGIN

DECLARE EXIT HANDLER FOR SQLEXCEPTION ROLLBACK;
DECLARE EXIT HANDLER FOR SQLWARNING ROLLBACK;

SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
START TRANSACTION;
  delete from report_chargebacks_daily;
  insert into report_chargebacks_daily select * from v_report_chargebacks_daily;
COMMIT;

END;
//
DELIMITER ;

-- PLUGIN DDL -> analytics-plugin -> v_report_payments_total_daily_sub1.ddl
create or replace view v_report_payments_total_daily_sub1 as
select
  ac.tenant_record_id
, 'CAPTURE' as op
, date_format(ac.created_date,'%Y-%m-%d') as day
, ac.currency
, sum(ifnull(ac.converted_amount, 0)) as count
from analytics_payment_captures ac
where 1=1
  and ac.payment_transaction_status = 'SUCCESS'
  and ac.report_group='default'
group by 1,2,3,4
union
select
  ap.tenant_record_id
, 'PURCHASE' as op
, date_format(ap.created_date,'%Y-%m-%d') as day
, ap.currency
, sum(ifnull(ap.converted_amount, 0)) as count
from analytics_payment_purchases ap
where 1=1
  and ap.payment_transaction_status = 'SUCCESS'
  and ap.report_group='default'
group by 1,2,3,4
;

-- PLUGIN DDL -> analytics-plugin -> v_report_payments_total_daily.ddl
create or replace view v_report_payments_total_daily as
select
  tenant_record_id
, day
, currency
, sum(count) as count
from v_report_payments_total_daily_sub1
group by 1,2,3
;

-- PLUGIN DDL -> analytics-plugin -> report_payments_total_daily.ddl
create table report_payments_total_daily as select * from v_report_payments_total_daily limit 0;

drop procedure if exists refresh_report_payments_total_daily;
DELIMITER //
CREATE PROCEDURE refresh_report_payments_total_daily()
BEGIN

DECLARE EXIT HANDLER FOR SQLEXCEPTION ROLLBACK;
DECLARE EXIT HANDLER FOR SQLWARNING ROLLBACK;

SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
START TRANSACTION;
  delete from report_payments_total_daily;
  insert into report_payments_total_daily select * from v_report_payments_total_daily;
COMMIT;

END;
//
DELIMITER ;

-- PLUGIN DDL -> analytics-plugin -> v_report_payments_by_provider_sub1.ddl
create or replace view v_report_payments_by_provider_sub1 as
SELECT
  a.plugin_name as plugin_name
, ifnull(a.plugin_property_4,'unknown') as merchant_account
, ifnull(a.plugin_property_5,'unknown') as payment_method
, 2 as timeframe
, a.tenant_record_id
, 'AUTHORIZE' as transaction_type
, count(1) as total
, sum(case when a.payment_transaction_status in ('UNKNOWN','PAYMENT_FAILURE','PLUGIN_FAILURE') then 1 else 0 end) as failed
, sum(case when a.payment_transaction_status = 'PENDING' then 1 else 0 end) as pending
, sum(case when a.payment_transaction_status = 'SUCCESS' then 1 else 0 end) as good
, sum(case when a.payment_transaction_status = 'SUCCESS' then a.converted_amount else 0 end) as converted_amount
, a.converted_currency
FROM analytics_payment_auths a
FORCE INDEX(analytics_payment_auths_created_date)
WHERE 1=1
AND a.created_date>now() - interval '7' day
GROUP BY
  a.plugin_name
, ifnull(a.plugin_property_4,'unknown')
, ifnull(a.plugin_property_5,'unknown')
, a.converted_currency
, a.tenant_record_id
UNION
SELECT
  a.plugin_name as plugin_name
, ifnull(a.plugin_property_4,'unknown') as merchant_account
, ifnull(a.plugin_property_5,'unknown') as payment_method
, 2 as timeframe
, a.tenant_record_id
, 'CAPTURE' as transaction_type
, count(1) as total
, sum(case when a.payment_transaction_status in ('UNKNOWN','PAYMENT_FAILURE','PLUGIN_FAILURE') then 1 else 0 end) as failed
, sum(case when a.payment_transaction_status = 'PENDING' then 1 else 0 end) as pending
, sum(case when a.payment_transaction_status = 'SUCCESS' then 1 else 0 end) as good
, sum(case when a.payment_transaction_status = 'SUCCESS' then a.converted_amount else 0 end) as converted_amount
, a.converted_currency
FROM analytics_payment_captures a
FORCE INDEX(analytics_payment_captures_created_date)
WHERE 1=1
AND a.created_date>now() - interval '7' day
GROUP BY
  a.plugin_name
, ifnull(a.plugin_property_4,'unknown')
, ifnull(a.plugin_property_5,'unknown')
, a.converted_currency
, a.tenant_record_id
UNION
SELECT
  a.plugin_name as plugin_name
, ifnull(a.plugin_property_4,'unknown') as merchant_account
, ifnull(a.plugin_property_5,'unknown') as payment_method
, 2 as timeframe
, a.tenant_record_id
, 'CHARGEBACK' as transaction_type
, count(1) as total
, sum(case when a.payment_transaction_status in ('UNKNOWN','PAYMENT_FAILURE','PLUGIN_FAILURE') then 1 else 0 end) as failed
, sum(case when a.payment_transaction_status = 'PENDING' then 1 else 0 end) as pending
, sum(case when a.payment_transaction_status = 'SUCCESS' then 1 else 0 end) as good
, sum(case when a.payment_transaction_status = 'SUCCESS' then a.converted_amount else 0 end) as converted_amount
, a.converted_currency
FROM analytics_payment_chargebacks a
FORCE INDEX(analytics_payment_chargebacks_created_date)
WHERE 1=1
AND a.created_date>now() - interval '7' day
GROUP BY
  a.plugin_name
, ifnull(a.plugin_property_4,'unknown')
, ifnull(a.plugin_property_5,'unknown')
, a.converted_currency
, a.tenant_record_id
UNION
SELECT
  a.plugin_name as plugin_name
, ifnull(a.plugin_property_4,'unknown') as merchant_account
, ifnull(a.plugin_property_5,'unknown') as payment_method
, 2 as timeframe
, a.tenant_record_id
, 'CREDIT' as transaction_type
, count(1) as total
, sum(case when a.payment_transaction_status in ('UNKNOWN','PAYMENT_FAILURE','PLUGIN_FAILURE') then 1 else 0 end) as failed
, sum(case when a.payment_transaction_status = 'PENDING' then 1 else 0 end) as pending
, sum(case when a.payment_transaction_status = 'SUCCESS' then 1 else 0 end) as good
, sum(case when a.payment_transaction_status = 'SUCCESS' then a.converted_amount else 0 end) as converted_amount
, a.converted_currency
FROM analytics_payment_credits a
FORCE INDEX(analytics_payment_credits_created_date)
WHERE 1=1
AND a.created_date>now() - interval '7' day
GROUP BY
  a.plugin_name
, ifnull(a.plugin_property_4,'unknown')
, ifnull(a.plugin_property_5,'unknown')
, a.converted_currency
, a.tenant_record_id
UNION
SELECT
  a.plugin_name as plugin_name
, ifnull(a.plugin_property_4,'unknown') as merchant_account
, ifnull(a.plugin_property_5,'unknown') as payment_method
, 2 as timeframe
, a.tenant_record_id
, 'PURCHASE' as transaction_type
, count(1) as total
, sum(case when a.payment_transaction_status in ('UNKNOWN','PAYMENT_FAILURE','PLUGIN_FAILURE') then 1 else 0 end) as failed
, sum(case when a.payment_transaction_status = 'PENDING' then 1 else 0 end) as pending
, sum(case when a.payment_transaction_status = 'SUCCESS' then 1 else 0 end) as good
, sum(case when a.payment_transaction_status = 'SUCCESS' then a.converted_amount else 0 end) as converted_amount
, a.converted_currency
FROM analytics_payment_purchases a
FORCE INDEX(analytics_payment_purchases_created_date)
WHERE 1=1
AND a.created_date>now() - interval '7' day
GROUP BY
  a.plugin_name
, ifnull(a.plugin_property_4,'unknown')
, ifnull(a.plugin_property_5,'unknown')
, a.converted_currency
, a.tenant_record_id
UNION
SELECT
  a.plugin_name as plugin_name
, ifnull(a.plugin_property_4,'unknown') as merchant_account
, ifnull(a.plugin_property_5,'unknown') as payment_method
, 2 as timeframe
, a.tenant_record_id
, 'REFUND' as transaction_type
, count(1) as total
, sum(case when a.payment_transaction_status in ('UNKNOWN','PAYMENT_FAILURE','PLUGIN_FAILURE') then 1 else 0 end) as failed
, sum(case when a.payment_transaction_status = 'PENDING' then 1 else 0 end) as pending
, sum(case when a.payment_transaction_status = 'SUCCESS' then 1 else 0 end) as good
, sum(case when a.payment_transaction_status = 'SUCCESS' then a.converted_amount else 0 end) as converted_amount
, a.converted_currency
FROM analytics_payment_refunds a
FORCE INDEX(analytics_payment_refunds_created_date)
WHERE 1=1
AND a.created_date>now() - interval '7' day
GROUP BY
  a.plugin_name
, ifnull(a.plugin_property_4,'unknown')
, ifnull(a.plugin_property_5,'unknown')
, a.converted_currency
, a.tenant_record_id
UNION
SELECT
  a.plugin_name as plugin_name
, ifnull(a.plugin_property_4,'unknown') as merchant_account
, ifnull(a.plugin_property_5,'unknown') as payment_method
, 2 as timeframe
, a.tenant_record_id
, 'VOID' as transaction_type
, count(1) as total
, sum(case when a.payment_transaction_status in ('UNKNOWN','PAYMENT_FAILURE','PLUGIN_FAILURE') then 1 else 0 end) as failed
, sum(case when a.payment_transaction_status = 'PENDING' then 1 else 0 end) as pending
, sum(case when a.payment_transaction_status = 'SUCCESS' then 1 else 0 end) as good
, sum(case when a.payment_transaction_status = 'SUCCESS' then a.converted_amount else 0 end) as converted_amount
, a.converted_currency
FROM analytics_payment_voids a
FORCE INDEX(analytics_payment_voids_created_date)
WHERE 1=1
AND a.created_date>now() - interval '7' day
GROUP BY
  a.plugin_name
, ifnull(a.plugin_property_4,'unknown')
, ifnull(a.plugin_property_5,'unknown')
, a.converted_currency
, a.tenant_record_id
UNION
--  ****************************************************************************************************************************
SELECT
  a.plugin_name as plugin_name
, ifnull(a.plugin_property_4,'unknown') as merchant_account
, ifnull(a.plugin_property_5,'unknown') as payment_method
, 3 as timeframe
, a.tenant_record_id
, 'AUTHORIZE' as transaction_type
, count(1) as total
, sum(case when a.payment_transaction_status in ('UNKNOWN','PAYMENT_FAILURE','PLUGIN_FAILURE') then 1 else 0 end) as failed
, sum(case when a.payment_transaction_status = 'PENDING' then 1 else 0 end) as pending
, sum(case when a.payment_transaction_status = 'SUCCESS' then 1 else 0 end) as good
, sum(case when a.payment_transaction_status = 'SUCCESS' then a.converted_amount else 0 end) as converted_amount
, a.converted_currency
FROM analytics_payment_auths a
WHERE 1=1
AND a.created_date>now() - interval '1' day
GROUP BY
  a.plugin_name
, ifnull(a.plugin_property_4,'unknown')
, ifnull(a.plugin_property_5,'unknown')
, a.converted_currency
, a.tenant_record_id
UNION
SELECT
  a.plugin_name as plugin_name
, ifnull(a.plugin_property_4,'unknown') as merchant_account
, ifnull(a.plugin_property_5,'unknown') as payment_method
, 3 as timeframe
, a.tenant_record_id
, 'CAPTURE' as transaction_type
, count(1) as total
, sum(case when a.payment_transaction_status in ('UNKNOWN','PAYMENT_FAILURE','PLUGIN_FAILURE') then 1 else 0 end) as failed
, sum(case when a.payment_transaction_status = 'PENDING' then 1 else 0 end) as pending
, sum(case when a.payment_transaction_status = 'SUCCESS' then 1 else 0 end) as good
, sum(case when a.payment_transaction_status = 'SUCCESS' then a.converted_amount else 0 end) as converted_amount
, a.converted_currency
FROM analytics_payment_captures a
WHERE 1=1
AND a.created_date>now() - interval '1' day
GROUP BY
  a.plugin_name
, ifnull(a.plugin_property_4,'unknown')
, ifnull(a.plugin_property_5,'unknown')
, a.converted_currency
, a.tenant_record_id
UNION
SELECT
  a.plugin_name as plugin_name
, ifnull(a.plugin_property_4,'unknown') as merchant_account
, ifnull(a.plugin_property_5,'unknown') as payment_method
, 3 as timeframe
, a.tenant_record_id
, 'CHARGEBACK' as transaction_type
, count(1) as total
, sum(case when a.payment_transaction_status in ('UNKNOWN','PAYMENT_FAILURE','PLUGIN_FAILURE') then 1 else 0 end) as failed
, sum(case when a.payment_transaction_status = 'PENDING' then 1 else 0 end) as pending
, sum(case when a.payment_transaction_status = 'SUCCESS' then 1 else 0 end) as good
, sum(case when a.payment_transaction_status = 'SUCCESS' then a.converted_amount else 0 end) as converted_amount
, a.converted_currency
FROM analytics_payment_chargebacks a
WHERE 1=1
AND a.created_date>now() - interval '1' day
GROUP BY
  a.plugin_name
, ifnull(a.plugin_property_4,'unknown')
, ifnull(a.plugin_property_5,'unknown')
, a.converted_currency
, a.tenant_record_id
UNION
SELECT
  a.plugin_name as plugin_name
, ifnull(a.plugin_property_4,'unknown') as merchant_account
, ifnull(a.plugin_property_5,'unknown') as payment_method
, 3 as timeframe
, a.tenant_record_id
, 'CREDIT' as transaction_type
, count(1) as total
, sum(case when a.payment_transaction_status in ('UNKNOWN','PAYMENT_FAILURE','PLUGIN_FAILURE') then 1 else 0 end) as failed
, sum(case when a.payment_transaction_status = 'PENDING' then 1 else 0 end) as pending
, sum(case when a.payment_transaction_status = 'SUCCESS' then 1 else 0 end) as good
, sum(case when a.payment_transaction_status = 'SUCCESS' then a.converted_amount else 0 end) as converted_amount
, a.converted_currency
FROM analytics_payment_credits a
WHERE 1=1
AND a.created_date>now() - interval '1' day
GROUP BY
  a.plugin_name
, ifnull(a.plugin_property_4,'unknown')
, ifnull(a.plugin_property_5,'unknown')
, a.converted_currency
, a.tenant_record_id
UNION
SELECT
  a.plugin_name as plugin_name
, ifnull(a.plugin_property_4,'unknown') as merchant_account
, ifnull(a.plugin_property_5,'unknown') as payment_method
, 3 as timeframe
, a.tenant_record_id
, 'PURCHASE' as transaction_type
, count(1) as total
, sum(case when a.payment_transaction_status in ('UNKNOWN','PAYMENT_FAILURE','PLUGIN_FAILURE') then 1 else 0 end) as failed
, sum(case when a.payment_transaction_status = 'PENDING' then 1 else 0 end) as pending
, sum(case when a.payment_transaction_status = 'SUCCESS' then 1 else 0 end) as good
, sum(case when a.payment_transaction_status = 'SUCCESS' then a.converted_amount else 0 end) as converted_amount
, a.converted_currency
FROM analytics_payment_purchases a
WHERE 1=1
AND a.created_date>now() - interval '1' day
GROUP BY
  a.plugin_name
, ifnull(a.plugin_property_4,'unknown')
, ifnull(a.plugin_property_5,'unknown')
, a.converted_currency
, a.tenant_record_id
UNION
SELECT
  a.plugin_name as plugin_name
, ifnull(a.plugin_property_4,'unknown') as merchant_account
, ifnull(a.plugin_property_5,'unknown') as payment_method
, 3 as timeframe
, a.tenant_record_id
, 'REFUND' as transaction_type
, count(1) as total
, sum(case when a.payment_transaction_status in ('UNKNOWN','PAYMENT_FAILURE','PLUGIN_FAILURE') then 1 else 0 end) as failed
, sum(case when a.payment_transaction_status = 'PENDING' then 1 else 0 end) as pending
, sum(case when a.payment_transaction_status = 'SUCCESS' then 1 else 0 end) as good
, sum(case when a.payment_transaction_status = 'SUCCESS' then a.converted_amount else 0 end) as converted_amount
, a.converted_currency
FROM analytics_payment_refunds a
WHERE 1=1
AND a.created_date>now() - interval '1' day
GROUP BY
  a.plugin_name
, ifnull(a.plugin_property_4,'unknown')
, ifnull(a.plugin_property_5,'unknown')
, a.converted_currency
, a.tenant_record_id
UNION
SELECT
  a.plugin_name as plugin_name
, ifnull(a.plugin_property_4,'unknown') as merchant_account
, ifnull(a.plugin_property_5,'unknown') as payment_method
, 3 as timeframe
, a.tenant_record_id
, 'VOID' as transaction_type
, count(1) as total
, sum(case when a.payment_transaction_status in ('UNKNOWN','PAYMENT_FAILURE','PLUGIN_FAILURE') then 1 else 0 end) as failed
, sum(case when a.payment_transaction_status = 'PENDING' then 1 else 0 end) as pending
, sum(case when a.payment_transaction_status = 'SUCCESS' then 1 else 0 end) as good
, sum(case when a.payment_transaction_status = 'SUCCESS' then a.converted_amount else 0 end) as converted_amount
, a.converted_currency
FROM analytics_payment_voids a
WHERE 1=1
AND a.created_date>now() - interval '1' day
GROUP BY
  a.plugin_name
, ifnull(a.plugin_property_4,'unknown')
, ifnull(a.plugin_property_5,'unknown')
, a.converted_currency
, a.tenant_record_id
UNION
--  ****************************************************************************************************************************
SELECT
  a.plugin_name as plugin_name
, ifnull(a.plugin_property_4,'unknown') as merchant_account
, ifnull(a.plugin_property_5,'unknown') as payment_method
, 4 as timeframe
, a.tenant_record_id
, 'AUTHORIZE' as transaction_type
, count(1) as total
, sum(case when a.payment_transaction_status in ('UNKNOWN','PAYMENT_FAILURE','PLUGIN_FAILURE') then 1 else 0 end) as failed
, sum(case when a.payment_transaction_status = 'PENDING' then 1 else 0 end) as pending
, sum(case when a.payment_transaction_status = 'SUCCESS' then 1 else 0 end) as good
, sum(case when a.payment_transaction_status = 'SUCCESS' then a.converted_amount else 0 end) as converted_amount
, a.converted_currency
FROM analytics_payment_auths a
WHERE 1=1
AND a.created_date>now() - interval '34' minute
AND a.created_date<=now() - interval '4' minute
GROUP BY
  a.plugin_name
, ifnull(a.plugin_property_4,'unknown')
, ifnull(a.plugin_property_5,'unknown')
, a.converted_currency
, a.tenant_record_id
UNION
SELECT
  a.plugin_name as plugin_name
, ifnull(a.plugin_property_4,'unknown') as merchant_account
, ifnull(a.plugin_property_5,'unknown') as payment_method
, 4 as timeframe
, a.tenant_record_id
, 'CAPTURE' as transaction_type
, count(1) as total
, sum(case when a.payment_transaction_status in ('UNKNOWN','PAYMENT_FAILURE','PLUGIN_FAILURE') then 1 else 0 end) as failed
, sum(case when a.payment_transaction_status = 'PENDING' then 1 else 0 end) as pending
, sum(case when a.payment_transaction_status = 'SUCCESS' then 1 else 0 end) as good
, sum(case when a.payment_transaction_status = 'SUCCESS' then a.converted_amount else 0 end) as converted_amount
, a.converted_currency
FROM analytics_payment_captures a
WHERE 1=1
AND a.created_date>now() - interval '34' minute
AND a.created_date<=now() - interval '4' minute
GROUP BY
  a.plugin_name
, ifnull(a.plugin_property_4,'unknown')
, ifnull(a.plugin_property_5,'unknown')
, a.converted_currency
, a.tenant_record_id
UNION
SELECT
  a.plugin_name as plugin_name
, ifnull(a.plugin_property_4,'unknown') as merchant_account
, ifnull(a.plugin_property_5,'unknown') as payment_method
, 4 as timeframe
, a.tenant_record_id
, 'CHARGEBACK' as transaction_type
, count(1) as total
, sum(case when a.payment_transaction_status in ('UNKNOWN','PAYMENT_FAILURE','PLUGIN_FAILURE') then 1 else 0 end) as failed
, sum(case when a.payment_transaction_status = 'PENDING' then 1 else 0 end) as pending
, sum(case when a.payment_transaction_status = 'SUCCESS' then 1 else 0 end) as good
, sum(case when a.payment_transaction_status = 'SUCCESS' then a.converted_amount else 0 end) as converted_amount
, a.converted_currency
FROM analytics_payment_chargebacks a
WHERE 1=1
AND a.created_date>now() - interval '34' minute
AND a.created_date<=now() - interval '4' minute
GROUP BY
  a.plugin_name
, ifnull(a.plugin_property_4,'unknown')
, ifnull(a.plugin_property_5,'unknown')
, a.converted_currency
, a.tenant_record_id
UNION
SELECT
  a.plugin_name as plugin_name
, ifnull(a.plugin_property_4,'unknown') as merchant_account
, ifnull(a.plugin_property_5,'unknown') as payment_method
, 4 as timeframe
, a.tenant_record_id
, 'CREDIT' as transaction_type
, count(1) as total
, sum(case when a.payment_transaction_status in ('UNKNOWN','PAYMENT_FAILURE','PLUGIN_FAILURE') then 1 else 0 end) as failed
, sum(case when a.payment_transaction_status = 'PENDING' then 1 else 0 end) as pending
, sum(case when a.payment_transaction_status = 'SUCCESS' then 1 else 0 end) as good
, sum(case when a.payment_transaction_status = 'SUCCESS' then a.converted_amount else 0 end) as converted_amount
, a.converted_currency
FROM analytics_payment_credits a
WHERE 1=1
AND a.created_date>now() - interval '34' minute
AND a.created_date<=now() - interval '4' minute
GROUP BY
  a.plugin_name
, ifnull(a.plugin_property_4,'unknown')
, ifnull(a.plugin_property_5,'unknown')
, a.converted_currency
, a.tenant_record_id
UNION
SELECT
  a.plugin_name as plugin_name
, ifnull(a.plugin_property_4,'unknown') as merchant_account
, ifnull(a.plugin_property_5,'unknown') as payment_method
, 4 as timeframe
, a.tenant_record_id
, 'PURCHASE' as transaction_type
, count(1) as total
, sum(case when a.payment_transaction_status in ('UNKNOWN','PAYMENT_FAILURE','PLUGIN_FAILURE') then 1 else 0 end) as failed
, sum(case when a.payment_transaction_status = 'PENDING' then 1 else 0 end) as pending
, sum(case when a.payment_transaction_status = 'SUCCESS' then 1 else 0 end) as good
, sum(case when a.payment_transaction_status = 'SUCCESS' then a.converted_amount else 0 end) as converted_amount
, a.converted_currency
FROM analytics_payment_purchases a
WHERE 1=1
AND a.created_date>now() - interval '34' minute
AND a.created_date<=now() - interval '4' minute
GROUP BY
  a.plugin_name
, ifnull(a.plugin_property_4,'unknown')
, ifnull(a.plugin_property_5,'unknown')
, a.converted_currency
, a.tenant_record_id
UNION
SELECT
  a.plugin_name as plugin_name
, ifnull(a.plugin_property_4,'unknown') as merchant_account
, ifnull(a.plugin_property_5,'unknown') as payment_method
, 4 as timeframe
, a.tenant_record_id
, 'REFUND' as transaction_type
, count(1) as total
, sum(case when a.payment_transaction_status in ('UNKNOWN','PAYMENT_FAILURE','PLUGIN_FAILURE') then 1 else 0 end) as failed
, sum(case when a.payment_transaction_status = 'PENDING' then 1 else 0 end) as pending
, sum(case when a.payment_transaction_status = 'SUCCESS' then 1 else 0 end) as good
, sum(case when a.payment_transaction_status = 'SUCCESS' then a.converted_amount else 0 end) as converted_amount
, a.converted_currency
FROM analytics_payment_refunds a
WHERE 1=1
AND a.created_date>now() - interval '34' minute
AND a.created_date<=now() - interval '4' minute
GROUP BY
  a.plugin_name
, ifnull(a.plugin_property_4,'unknown')
, ifnull(a.plugin_property_5,'unknown')
, a.converted_currency
, a.tenant_record_id
UNION
SELECT
  a.plugin_name as plugin_name
, ifnull(a.plugin_property_4,'unknown') as merchant_account
, ifnull(a.plugin_property_5,'unknown') as payment_method
, 4 as timeframe
, a.tenant_record_id
, 'VOID' as transaction_type
, count(1) as total
, sum(case when a.payment_transaction_status in ('UNKNOWN','PAYMENT_FAILURE','PLUGIN_FAILURE') then 1 else 0 end) as failed
, sum(case when a.payment_transaction_status = 'PENDING' then 1 else 0 end) as pending
, sum(case when a.payment_transaction_status = 'SUCCESS' then 1 else 0 end) as good
, sum(case when a.payment_transaction_status = 'SUCCESS' then a.converted_amount else 0 end) as converted_amount
, a.converted_currency
FROM analytics_payment_voids a
WHERE 1=1
AND a.created_date>now() - interval '34' minute
AND a.created_date<=now() - interval '4' minute
GROUP BY
  a.plugin_name
, ifnull(a.plugin_property_4,'unknown')
, ifnull(a.plugin_property_5,'unknown')
, a.converted_currency
, a.tenant_record_id
;

-- PLUGIN DDL -> analytics-plugin -> v_report_payments_by_provider_sub2.ddl
create or replace view v_report_payments_by_provider_sub2 as
select distinct plugin_name,ifnull(plugin_property_4,'unknown') as merchant_account,ifnull(plugin_property_5,'unknown') as payment_method,converted_currency,tenant_record_id from analytics_payment_auths force index(analytics_payment_auths_date_trid_plugin_name) where created_date > now() - interval '7' day
union
select distinct plugin_name,ifnull(plugin_property_4,'unknown') as merchant_account,ifnull(plugin_property_5,'unknown') as payment_method,converted_currency,tenant_record_id from analytics_payment_captures force index(analytics_payment_captures_date_trid_plugin_name) where created_date > now() - interval '7' day
union
select distinct plugin_name,ifnull(plugin_property_4,'unknown') as merchant_account,ifnull(plugin_property_5,'unknown') as payment_method,converted_currency,tenant_record_id from analytics_payment_chargebacks force index(analytics_payment_chargebacks_date_trid_plugin_name) where created_date > now() - interval '7' day
union
select distinct plugin_name,ifnull(plugin_property_4,'unknown') as merchant_account,ifnull(plugin_property_5,'unknown') as payment_method,converted_currency,tenant_record_id from analytics_payment_credits force index(analytics_payment_credits_date_trid_plugin_name) where created_date > now() - interval '7' day
union
select distinct plugin_name,ifnull(plugin_property_4,'unknown') as merchant_account,ifnull(plugin_property_5,'unknown') as payment_method,converted_currency,tenant_record_id from analytics_payment_purchases force index(analytics_payment_purchases_date_trid_plugin_name) where created_date > now() - interval '7' day
union
select distinct plugin_name,ifnull(plugin_property_4,'unknown') as merchant_account,ifnull(plugin_property_5,'unknown') as payment_method,converted_currency,tenant_record_id from analytics_payment_refunds force index(analytics_payment_refunds_date_trid_plugin_name) where created_date > now() - interval '7' day
union
select distinct plugin_name,ifnull(plugin_property_4,'unknown') as merchant_account,ifnull(plugin_property_5,'unknown') as payment_method,converted_currency,tenant_record_id from analytics_payment_voids force index(analytics_payment_voids_date_trid_plugin_name) where created_date > now() - interval '7' day
;

-- PLUGIN DDL -> analytics-plugin -> v_report_payments_by_provider_sub3.ddl
create or replace view v_report_payments_by_provider_sub3 as
select  1 as timeframe union select 2 as timeframe union select 3 as timeframe union select 4 as timeframe
;

-- PLUGIN DDL -> analytics-plugin -> v_report_payments_by_provider.ddl
create or replace view v_report_payments_by_provider as
SELECT
  t1.plugin_name
, t1.merchant_account
, t1.payment_method
, t1.tenant_record_id
, t2.timeframe
, transaction_type
, case when t2.timeframe=1 then 'Last 30 days'
       when t2.timeframe=2 then 'Last 7 days'
       when t2.timeframe=3 then 'Last 24 hours'
       when t2.timeframe=4 then 'Last 30 min'
  end as period
, sum(ifnull(total,0)) as total
, sum(ifnull(failed,0)) as failed
, sum(ifnull(pending,0)) as pending
, sum(ifnull(good,0)) as good
, case when failed is not null and total is not null then concat(round(((sum(failed)/sum(total))*100),2),'%')
       else '0%'
  end as pct_failed
, case when failed is not null and total is not null then concat(round(((sum(pending)/sum(total))*100),2),'%')
       else '0%'
  end as pct_pending
, case when failed is not null and total is not null then concat(round(((sum(good)/sum(total))*100),2),'%')
       else '0%'
  end as pct_good
, converted_amount
, t1.converted_currency
, sysdate() as refresh_date
FROM v_report_payments_by_provider_sub2 t1
INNER JOIN v_report_payments_by_provider_sub3 t2
LEFT OUTER JOIN v_report_payments_by_provider_sub1 v1 on v1.plugin_name=t1.plugin_name
AND v1.merchant_account=t1.merchant_account
AND v1.payment_method=t1.payment_method
AND v1.timeframe=t2.timeframe
AND v1.converted_currency=t1.converted_currency
AND v1.tenant_record_id=t1.tenant_record_id
GROUP BY
  plugin_name
, merchant_account
, payment_method
, timeframe
, transaction_type
, converted_currency
, tenant_record_id
ORDER BY
  tenant_record_id
, merchant_account
, payment_method
, plugin_name
, timeframe
, transaction_type
, converted_currency
;

-- PLUGIN DDL -> analytics-plugin -> v_report_payments_by_provider_last_24h_summary.ddl
create or replace view v_report_payments_by_provider_last_24h_summary as
select
  tenant_record_id
, payment_method as label
, sum(total) as count
from v_report_payments_by_provider
where 1 = 1
and timeframe = 3
and transaction_type in ('AUTHORIZE', 'PURCHASE')
group by 1,2
;

-- PLUGIN DDL -> analytics-plugin -> refresh_report_payments_by_provider_last_24h_summary.ddl
create table report_payments_by_provider_last_24h_summary as select * from v_report_payments_by_provider_last_24h_summary limit 0;

drop procedure if exists refresh_report_payments_by_provider_last_24h_summary;
DELIMITER //
CREATE PROCEDURE refresh_report_payments_by_provider_last_24h_summary()
BEGIN

DECLARE EXIT HANDLER FOR SQLEXCEPTION ROLLBACK;
DECLARE EXIT HANDLER FOR SQLWARNING ROLLBACK;

SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
START TRANSACTION;
  delete from report_payments_by_provider_last_24h_summary;
  insert into report_payments_by_provider_last_24h_summary select * from v_report_payments_by_provider_last_24h_summary;
COMMIT;

END;
//
DELIMITER ;

-- PLUGIN DDL -> analytics-plugin -> refresh_report_payments_by_provider_history.ddl
create table report_payments_by_provider_history as select * from v_report_payments_by_provider limit 0;

drop procedure if exists refresh_report_payments_by_provider_history;
DELIMITER //
CREATE PROCEDURE refresh_report_payments_by_provider_history()
BEGIN

DECLARE EXIT HANDLER FOR SQLEXCEPTION ROLLBACK;
DECLARE EXIT HANDLER FOR SQLWARNING ROLLBACK;

SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
insert into report_payments_by_provider_history select * from v_report_payments_by_provider;

END;
//
DELIMITER ;

-- PLUGIN DDL -> analytics-plugin -> v_report_payment_provider_monitor_sub1.ddl
create or replace view v_report_payment_provider_monitor_sub1 as
SELECT distinct
  apa.plugin_name
, ifnull(apa.plugin_property_4,'unknown') as merchant_account
, ifnull(apa.plugin_property_5,'unknown') as payment_method
, apa.tenant_record_id
FROM analytics_payment_auths apa
WHERE 1=1
AND apa.created_date > now() - interval '7' day
UNION
SELECT distinct
  app.plugin_name
, ifnull(app.plugin_property_4,'unknown') as merchant_account
, ifnull(app.plugin_property_5,'unknown') as payment_method
, app.tenant_record_id
FROM analytics_payment_purchases app
WHERE 1=1
AND app.created_date > now() - interval '7' day
;

-- PLUGIN DDL -> analytics-plugin -> v_report_payment_provider_monitor_sub2.ddl
create or replace view v_report_payment_provider_monitor_sub2 as
SELECT
  apa.plugin_name
, ifnull(apa.plugin_property_4,'unknown') as merchant_account
, ifnull(apa.plugin_property_5,'unknown') as payment_method
, apa.tenant_record_id
, sum(case when apa.created_date > now() - interval 1 hour then 1 else 0 end) success_count_last_hour
, count(1) success_count_last_12_hours
FROM analytics_payment_auths apa
WHERE 1=1
AND apa.payment_transaction_status = 'SUCCESS'
AND apa.created_date > now() - interval '12' hour
GROUP BY
  apa.plugin_name
, ifnull(apa.plugin_property_4,'unknown')
, ifnull(apa.plugin_property_5,'unknown')
, apa.tenant_record_id
UNION
SELECT
  app.plugin_name
, ifnull(app.plugin_property_4,'unknown') as merchant_account
, ifnull(app.plugin_property_5,'unknown') as payment_method
, app.tenant_record_id
, sum(case when app.created_date > now() - interval 1 hour then 1 else 0 end) success_count_last_hour
, count(1) success_count_last_12_hours
FROM analytics_payment_purchases app
WHERE 1=1
AND app.payment_transaction_status = 'SUCCESS'
AND app.created_date > now() - interval '12' hour
GROUP BY
  app.plugin_name
, ifnull(app.plugin_property_4,'unknown')
, ifnull(app.plugin_property_5,'unknown')
, app.tenant_record_id
;

-- PLUGIN DDL -> analytics-plugin -> v_report_payment_provider_monitor_sub3.ddl
create or replace view v_report_payment_provider_monitor_sub3 as
SELECT
  plugin_name
, merchant_account
, payment_method
, tenant_record_id
, sum(ifnull(success_count_last_hour,0)) as success_count_last_hour
, sum(ifnull(success_count_last_12_hours,0)) as success_count_last_12_hours
FROM v_report_payment_provider_monitor_sub2 t2
GROUP BY
  plugin_name
, merchant_account
, payment_method
, tenant_record_id
;

-- PLUGIN DDL -> analytics-plugin -> v_report_payment_provider_monitor.ddl
create or replace view v_report_payment_provider_monitor as
SELECT
  plugin_list.plugin_name
, plugin_list.merchant_account
, plugin_list.payment_method
, plugin_list.tenant_record_id
, ifnull(recent_success_trx.success_count_last_hour,0) as success_count_last_hour
, ifnull(recent_success_trx.success_count_last_12_hours,0) as success_count_last_12_hours
, sysdate() as refresh_date
FROM v_report_payment_provider_monitor_sub1 plugin_list
LEFT OUTER JOIN v_report_payment_provider_monitor_sub3 recent_success_trx on
    plugin_list.plugin_name=recent_success_trx.plugin_name
AND plugin_list.merchant_account=recent_success_trx.merchant_account
AND plugin_list.payment_method=recent_success_trx.payment_method
AND plugin_list.tenant_record_id=recent_success_trx.tenant_record_id
;

-- PLUGIN DDL -> analytics-plugin -> refresh_report_payment_provider_monitor_history.ddl
create table report_payment_provider_monitor_history as select * from v_report_payment_provider_monitor limit 0;

drop procedure if exists refresh_report_payment_provider_monitor_history;
DELIMITER //
CREATE PROCEDURE refresh_report_payment_provider_monitor_history()
BEGIN

DECLARE EXIT HANDLER FOR SQLEXCEPTION ROLLBACK;
DECLARE EXIT HANDLER FOR SQLWARNING ROLLBACK;

SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
insert into report_payment_provider_monitor_history select * from v_report_payment_provider_monitor;

END;
//
DELIMITER ;

-- PLUGIN DDL -> analytics-plugin -> v_report_refunds_total_daily.ddl
create or replace view v_report_refunds_total_daily as
select
  ar.tenant_record_id
, date_format(ar.created_date,'%Y-%m-%d') as day
, ar.currency as currency
, sum(ar.converted_amount) as count
from
  analytics_payment_refunds ar
where 1=1
  and ar.report_group='default'
group by 1,2,3
;

-- PLUGIN DDL -> analytics-plugin -> report_refunds_total_daily.ddl
create table report_refunds_total_daily as select * from v_report_refunds_total_daily limit 0;

drop procedure if exists refresh_report_refunds_total_daily;
DELIMITER //
CREATE PROCEDURE refresh_report_refunds_total_daily()
BEGIN

DECLARE EXIT HANDLER FOR SQLEXCEPTION ROLLBACK;
DECLARE EXIT HANDLER FOR SQLWARNING ROLLBACK;

SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
START TRANSACTION;
  delete from report_refunds_total_daily;
  insert into report_refunds_total_daily select * from v_report_refunds_total_daily;
COMMIT;

END;
//
DELIMITER ;

-- PLUGIN DDL -> analytics-plugin -> v_report_invoices_daily.ddl
create or replace view v_report_invoices_daily as
select
  ai.tenant_record_id
, date_format(ai.created_date,'%Y-%m-%d') as day
, ai.currency
, sum(ai.converted_original_amount_charged) as count
from
  analytics_invoices ai
where 1=1
  and ai.report_group='default'
group by 1,2,3
;

-- PLUGIN DDL -> analytics-plugin -> report_invoices_daily.ddl
create table report_invoices_daily as select * from v_report_invoices_daily limit 0;

drop procedure if exists refresh_report_invoices_daily;
DELIMITER //
CREATE PROCEDURE refresh_report_invoices_daily()
BEGIN

DECLARE EXIT HANDLER FOR SQLEXCEPTION ROLLBACK;
DECLARE EXIT HANDLER FOR SQLWARNING ROLLBACK;

SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
START TRANSACTION;
  delete from report_invoices_daily;
  insert into report_invoices_daily select * from v_report_invoices_daily;
COMMIT;

END;
//
DELIMITER ;

-- PLUGIN DDL -> analytics-plugin -> v_report_invoices_balance_daily.ddl
create or replace view v_report_invoices_balance_daily as
select
  ai.tenant_record_id
, date_format(ai.created_date,'%Y-%m-%d') as day
, sum(ai.converted_balance) as count
from
  analytics_invoices ai
where 1=1
  and ai.report_group='default'
group by 1,2
;

-- PLUGIN DDL -> analytics-plugin -> report_invoices_balance_daily.ddl
create table report_invoices_balance_daily as select * from v_report_invoices_balance_daily limit 0;

drop procedure if exists refresh_report_invoices_balance_daily;
DELIMITER //
CREATE PROCEDURE refresh_report_invoices_balance_daily()
BEGIN

DECLARE EXIT HANDLER FOR SQLEXCEPTION ROLLBACK;
DECLARE EXIT HANDLER FOR SQLWARNING ROLLBACK;

SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
START TRANSACTION;
  delete from report_invoices_balance_daily;
  insert into report_invoices_balance_daily select * from v_report_invoices_balance_daily;
COMMIT;

END;
//
DELIMITER ;

-- PLUGIN DDL -> analytics-plugin -> v_report_payment_provider_conversion_sub1.ddl
create or replace view v_report_payment_provider_conversion_sub1 as
SELECT
  apa.plugin_name
, ifnull(apa.plugin_property_4,'unknown') as merchant_account
, ifnull(apa.plugin_property_5,'unknown') as payment_method
, apa.tenant_record_id
, sum(case when apa.payment_transaction_status='SUCCESS' then 1 else 0 end) as current_success_count
, count(1) as current_transaction_count
, count(distinct apa.account_id) as current_customer_count
FROM
    analytics_payment_auths apa
WHERE 1=1
AND apa.created_date >= FROM_UNIXTIME(UNIX_TIMESTAMP(NOW()) - 15*60 - (UNIX_TIMESTAMP(NOW()) - 15*60)%(15*60))
AND cast(FROM_UNIXTIME(UNIX_TIMESTAMP(apa.created_date) - UNIX_TIMESTAMP(apa.created_date)%(15*60)) as time) = cast(FROM_UNIXTIME(UNIX_TIMESTAMP(NOW()) - 15*60 - (UNIX_TIMESTAMP(NOW()) - 15*60)%(15*60)) as time)
GROUP BY
  apa.plugin_name
, ifnull(apa.plugin_property_4,'unknown')
, ifnull(apa.plugin_property_5,'unknown')
, apa.tenant_record_id
UNION
SELECT
  app.plugin_name
, ifnull(app.plugin_property_4,'unknown') as merchant_account
, ifnull(app.plugin_property_5,'unknown') as payment_method
, app.tenant_record_id
, sum(case when app.payment_transaction_status='SUCCESS' then 1 else 0 end) as current_success_count
, count(1) as current_transaction_count
, count(distinct app.account_id) as current_customer_count
FROM
    analytics_payment_purchases app
WHERE 1=1
AND app.created_date >= FROM_UNIXTIME(UNIX_TIMESTAMP(NOW()) - 15*60 - (UNIX_TIMESTAMP(NOW()) - 15*60)%(15*60))
AND cast(FROM_UNIXTIME(UNIX_TIMESTAMP(app.created_date) - UNIX_TIMESTAMP(app.created_date)%(15*60)) as time) = cast(FROM_UNIXTIME(UNIX_TIMESTAMP(NOW()) - 15*60 - (UNIX_TIMESTAMP(NOW()) - 15*60)%(15*60)) as time)
GROUP BY
  app.plugin_name
, ifnull(app.plugin_property_4,'unknown')
, ifnull(app.plugin_property_5,'unknown')
, app.tenant_record_id
;

-- PLUGIN DDL -> analytics-plugin -> v_report_payment_provider_conversion_sub2.ddl
create or replace view v_report_payment_provider_conversion_sub2 as
SELECT
  apa.plugin_name
, ifnull(apa.plugin_property_4,'unknown') as merchant_account
, ifnull(apa.plugin_property_5,'unknown') as payment_method
, apa.tenant_record_id
, sum(case when apa.payment_transaction_status='SUCCESS' then 1 else 0 end) as historical_success_count
, count(1) as historical_transaction_count
, count(distinct apa.account_id) as historical_customer_count
FROM
    analytics_payment_auths apa
WHERE 1=1
AND apa.created_date < FROM_UNIXTIME(UNIX_TIMESTAMP(NOW() - interval '14' day) - 15*60 - (UNIX_TIMESTAMP(NOW() - interval '14' day) - 15*60)%(15*60) + 15*60)
AND cast(FROM_UNIXTIME(UNIX_TIMESTAMP(apa.created_date) - UNIX_TIMESTAMP(apa.created_date)%(15*60)) as time) = cast(FROM_UNIXTIME(UNIX_TIMESTAMP(NOW() - interval '14' day) - 15*60 - (UNIX_TIMESTAMP(NOW() - interval '14' day) - 15*60)%(15*60)) as time)
AND apa.created_date >= FROM_UNIXTIME(UNIX_TIMESTAMP(NOW() - interval '14' day) - 15*60 - (UNIX_TIMESTAMP(NOW() - interval '14' day) - 15*60)%(15*60))
GROUP BY
  apa.plugin_name
, ifnull(apa.plugin_property_4,'unknown')
, ifnull(apa.plugin_property_5,'unknown')
, apa.tenant_record_id
UNION
SELECT
  app.plugin_name
, ifnull(app.plugin_property_4,'unknown') as merchant_account
, ifnull(app.plugin_property_5,'unknown') as payment_method
, app.tenant_record_id
, sum(case when app.payment_transaction_status='SUCCESS' then 1 else 0 end) as historical_success_count
, count(1) as historical_transaction_count
, count(distinct app.account_id) as historical_customer_count
FROM
    analytics_payment_purchases app
WHERE 1=1
AND app.created_date < FROM_UNIXTIME(UNIX_TIMESTAMP(NOW() - interval '14' day) - 15*60 - (UNIX_TIMESTAMP(NOW() - interval '14' day) - 15*60)%(15*60) + 15*60)
AND cast(FROM_UNIXTIME(UNIX_TIMESTAMP(app.created_date) - UNIX_TIMESTAMP(app.created_date)%(15*60)) as time) = cast(FROM_UNIXTIME(UNIX_TIMESTAMP(NOW() - interval '14' day) - 15*60 - (UNIX_TIMESTAMP(NOW() - interval '14' day) - 15*60)%(15*60)) as time)
AND app.created_date >= FROM_UNIXTIME(UNIX_TIMESTAMP(NOW() - interval '14' day) - 15*60 - (UNIX_TIMESTAMP(NOW() - interval '14' day) - 15*60)%(15*60))
GROUP BY
  app.plugin_name
, ifnull(app.plugin_property_4,'unknown')
, ifnull(app.plugin_property_5,'unknown')
, app.tenant_record_id
;

-- PLUGIN DDL -> analytics-plugin -> v_report_payment_provider_conversion.ddl
create or replace view v_report_payment_provider_conversion as
select
  rpccs1.plugin_name
, rpccs1.merchant_account
, rpccs1.payment_method
, rpccs1.tenant_record_id    
, ifnull(sum(rpccs1.current_success_count),0) as current_success_count
, ifnull(sum(rpccs1.current_transaction_count),0) as current_transaction_count
, ifnull(sum(rpccs1.current_customer_count),0) as current_customer_count
, ifnull(sum(rpccs2.historical_success_count),0) as historical_success_count
, ifnull(sum(rpccs2.historical_transaction_count),0) as historical_transaction_count
, ifnull(sum(rpccs2.historical_customer_count),0) as historical_customer_count
, case when current_success_count is not null and historical_success_count is not null
       then concat(round((((sum(rpccs1.current_success_count)-sum(rpccs2.historical_success_count))/sum(rpccs2.historical_success_count))*100),2),'%')
       else '0%'
  end success_delta
, case when current_transaction_count is not null and historical_transaction_count is not null
       then concat(round((((sum(rpccs1.current_transaction_count)-sum(rpccs2.historical_transaction_count))/sum(rpccs2.historical_transaction_count))*100),2),'%')
       else '0%'
  end transaction_delta
, case when current_customer_count is not null and historical_customer_count is not null
       then concat(round((((sum(rpccs1.current_customer_count)-sum(rpccs2.historical_customer_count))/sum(rpccs2.historical_customer_count))*100),2),'%')
       else '0%'
  end customer_delta
, sysdate() as refresh_date
from v_report_payment_provider_conversion_sub2 rpccs2
LEFT OUTER JOIN v_report_payment_provider_conversion_sub1 rpccs1 ON
    rpccs1.plugin_name=rpccs2.plugin_name
AND rpccs1.merchant_account=rpccs2.merchant_account
AND rpccs1.payment_method=rpccs2.payment_method
AND rpccs1.tenant_record_id=rpccs2.tenant_record_id
GROUP BY
  plugin_name
, merchant_account
, payment_method
, tenant_record_id
;

-- PLUGIN DDL -> analytics-plugin -> refresh_report_payment_provider_conversion_history.ddl
create table report_payment_provider_conversion_history as select * from v_report_payment_provider_conversion limit 0;

drop procedure if exists refresh_report_payment_provider_conversion_history;
DELIMITER //
CREATE PROCEDURE refresh_report_payment_provider_conversion_history()
BEGIN

DECLARE EXIT HANDLER FOR SQLEXCEPTION ROLLBACK;
DECLARE EXIT HANDLER FOR SQLWARNING ROLLBACK;

SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
insert into report_payment_provider_conversion_history select * from v_report_payment_provider_conversion;

END;
//
DELIMITER ;

-- PLUGIN DDL -> analytics-plugin -> report_conversions_total_dollar_monthly.ddl
drop table if exists report_conversions_total_dollar_monthly;
create table report_conversions_total_dollar_monthly (tenant_record_id int(11), day date, term varchar(50), count int(10));

-- PLUGIN DDL -> analytics-plugin -> refresh_report_conversions_total_dollar_monthly.prc
drop procedure if exists refresh_report_conversions_total_dollar_monthly;
DELIMITER //
CREATE PROCEDURE refresh_report_conversions_total_dollar_monthly()
BEGIN

    DELETE FROM report_conversions_total_dollar_monthly;

    create temporary table report_temp_paid_bundles (index (bundle_id)) as
    select distinct
      tenant_record_id
    , bundle_id
    from
      analytics_invoice_items
    where 1=1
      and invoice_original_amount_charged > 0
      and invoice_balance = 0
    ;

    insert into report_conversions_total_dollar_monthly
    select
      ast.tenant_record_id
    , date_format(next_start_date, '%Y-%m-01') day
    , next_billing_period billing_period
    , round(sum(converted_next_price)) count
    from
      analytics_subscription_transitions ast
      join report_temp_paid_bundles paid_bundles on ast.bundle_id = paid_bundles.bundle_id and ast.tenant_record_id = paid_bundles.tenant_record_id
    where 1=1
      and report_group='default'
      and next_service='entitlement-service'
      and prev_phase='TRIAL'
      and next_phase!='TRIAL'
      and event not like 'STOP_ENTITLEMENT%'
    group by 1,2,3
    ;

END;
//
DELIMITER ;

-- PLUGIN DDL -> analytics-plugin -> v_report_cancellations_daily.ddl
create or replace view v_report_cancellations_daily as
select
  ast.tenant_record_id
, ast.prev_phase phase
, date_format(ast.next_start_date,'%Y-%m-%d') as day
, count(0) as count
from
  analytics_subscription_transitions ast
where 1=1
  and ast.event='STOP_ENTITLEMENT_BASE'
  and ast.report_group='default'
  and ast.prev_phase is not null
group by 1,2,3
;

-- PLUGIN DDL -> analytics-plugin -> report_cancellations_daily.ddl
create table report_cancellations_daily as select * from v_report_cancellations_daily limit 0;

drop procedure if exists refresh_report_cancellations_daily;
DELIMITER //
CREATE PROCEDURE refresh_report_cancellations_daily()
BEGIN

DECLARE EXIT HANDLER FOR SQLEXCEPTION ROLLBACK;
DECLARE EXIT HANDLER FOR SQLWARNING ROLLBACK;

SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
START TRANSACTION;
  delete from report_cancellations_daily;
  insert into report_cancellations_daily select * from v_report_cancellations_daily;
COMMIT;

END;
//
DELIMITER ;

-- PLUGIN DDL -> analytics-plugin -> v_report_accounts_summary.ddl
create or replace view v_report_accounts_summary as
select
  a.tenant_record_id
, case when nb_active_bundles <= 0 then 'Non-subscriber' else 'Subscriber' end as label
, count(distinct a.account_record_id) as count
from
  analytics_accounts a
where 1 = 1
  and report_group = 'default'
group by 1,2
;

-- PLUGIN DDL -> analytics-plugin -> report_accounts_summary.ddl
create table report_accounts_summary as select * from v_report_accounts_summary limit 0;

drop procedure if exists refresh_report_accounts_summary;
DELIMITER //
CREATE PROCEDURE refresh_report_accounts_summary()
BEGIN

DECLARE EXIT HANDLER FOR SQLEXCEPTION ROLLBACK;
DECLARE EXIT HANDLER FOR SQLWARNING ROLLBACK;

SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
START TRANSACTION;
  delete from report_accounts_summary;
  insert into report_accounts_summary select * from v_report_accounts_summary;
COMMIT;

END;
//
DELIMITER ;

-- PLUGIN DDL -> analytics-plugin -> v_report_mrr_daily.ddl
create or replace view v_report_mrr_daily as
select
  ast.tenant_record_id
, ifnull(ast.next_product_name, ast.prev_product_name) as product
, date_format(cal.d,'%Y-%m-%d') as day
, sum(ast.converted_next_mrr) as count
from
  calendar cal
  left join analytics_subscription_transitions ast on cast(date_format(ast.next_start_date, '%Y-%m-%d') as date) <= cast(date_format(cal.d, '%Y-%m-%d') as date)
    and case when ast.next_end_date is not null then ast.next_end_date > cast(date_format(cal.d, '%Y-%m-%d') as date) else 1=1 end
where 1=1
  and cal.d <= now()
  and ast.report_group='default'
  and ast.next_service='entitlement-service'
  and ifnull(ast.next_mrr, 0) > 0
group by 1,2,3
union select
  ast.tenant_record_id
, 'ALL' as product
, date_format(cal.d,'%Y-%m-%d') as day
, sum(ast.converted_next_mrr) as count
from
  calendar cal
  left join analytics_subscription_transitions ast on cast(date_format(ast.next_start_date, '%Y-%m-%d') as date) <= cast(date_format(cal.d, '%Y-%m-%d') as date)
    and case when ast.next_end_date is not null then ast.next_end_date > cast(date_format(cal.d, '%Y-%m-%d') as date) else 1=1 end
where 1=1
  and cal.d <= now()
  and ast.report_group='default'
  and ast.next_service='entitlement-service'
  and ifnull(ast.next_mrr, 0) > 0
group by 1,2,3
;

-- PLUGIN DDL -> analytics-plugin -> report_mrr_daily.ddl
create table report_mrr_daily as select * from v_report_mrr_daily limit 0;

drop procedure if exists refresh_report_mrr_daily;
DELIMITER //
CREATE PROCEDURE refresh_report_mrr_daily()
BEGIN

DECLARE EXIT HANDLER FOR SQLEXCEPTION ROLLBACK;
DECLARE EXIT HANDLER FOR SQLWARNING ROLLBACK;

SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
START TRANSACTION;
  delete from report_mrr_daily;
  insert into report_mrr_daily select * from v_report_mrr_daily;
COMMIT;

END;
//
DELIMITER ;

-- PLUGIN DDL -> analytics-plugin -> v_report_payment_provider_errors_sub1.ddl
create or replace view v_report_payment_provider_errors_sub1 as
select
  aa.tenant_record_id
, 'AUTH' as op
, date_format(aa.created_date,'%Y-%m-%d') as day
, aa.currency
, aa.plugin_name
, aa.record_id
from analytics_payment_auths aa
where 1=1
  and aa.payment_transaction_status not in ('PENDING', 'SUCCESS')
  and aa.report_group = 'default'
  and aa.created_date > now() - interval '60' day
union
select
  ap.tenant_record_id
, 'PURCHASE' as op
, date_format(ap.created_date,'%Y-%m-%d') as day
, ap.currency
, ap.plugin_name
, ap.record_id
from analytics_payment_purchases ap
where 1=1
  and ap.payment_transaction_status not in ('PENDING', 'SUCCESS')
  and ap.report_group = 'default'
  and ap.created_date > now() - interval '60' day
;

-- PLUGIN DDL -> analytics-plugin -> v_report_payment_provider_errors_sub2.ddl
create or replace view v_report_payment_provider_errors_sub2 as
select
  v1.tenant_record_id
, v1.day
, v1.currency
, v1.plugin_name
, substring_index(ifnull(apa.plugin_gateway_error, app.plugin_gateway_error), ' ', 10) as plugin_gateway_error
, count(1) as count
from v_report_payment_provider_errors_sub1 v1
left join analytics_payment_auths apa on apa.record_id = v1.record_id and v1.op = 'AUTH'
left join analytics_payment_purchases app on app.record_id = v1.record_id and v1.op = 'PURCHASE'
where 1=1
and ifnull(apa.plugin_gateway_error, app.plugin_gateway_error) is not null
group by 1,2,3,4,5
;

-- PLUGIN DDL -> analytics-plugin -> v_report_payment_provider_errors.ddl
create or replace view v_report_payment_provider_errors as
select
  tenant_record_id
, day
, currency
, plugin_name
, plugin_gateway_error
, count
from v_report_payment_provider_errors_sub2 sub2
where (
  select count(*) from v_report_payment_provider_errors_sub2 as sub21
  where 1=1
    and sub21.tenant_record_id = sub2.tenant_record_id
    and sub21.day = sub2.day
    and sub21.currency = sub2.currency
    and sub21.plugin_name = sub2.plugin_name
    and sub21.count >= sub2.count
) <= 3
;

-- PLUGIN DDL -> analytics-plugin -> report_payment_provider_errors.ddl
create table report_payment_provider_errors_sub2 as select * from v_report_payment_provider_errors_sub2 limit 0;
create table report_payment_provider_errors as select * from v_report_payment_provider_errors limit 0;

drop procedure if exists refresh_report_payment_provider_errors;
DELIMITER //
CREATE PROCEDURE refresh_report_payment_provider_errors()
BEGIN

DECLARE EXIT HANDLER FOR SQLEXCEPTION ROLLBACK;
DECLARE EXIT HANDLER FOR SQLWARNING ROLLBACK;

SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;

START TRANSACTION;
  delete from report_payment_provider_errors_sub2;
  insert into report_payment_provider_errors_sub2 select * from v_report_payment_provider_errors_sub2;

  delete from report_payment_provider_errors;
  insert into report_payment_provider_errors
    select
      tenant_record_id
    , day
    , currency
    , plugin_name
    , plugin_gateway_error
    , count
    from report_payment_provider_errors_sub2 sub2
    where (
      select count(*) from report_payment_provider_errors_sub2 as sub21
      where 1=1
        and sub21.tenant_record_id = sub2.tenant_record_id
        and sub21.day = sub2.day
        and sub21.currency = sub2.currency
        and sub21.plugin_name = sub2.plugin_name
        and sub21.count >= sub2.count
    ) <= 3
  ;
COMMIT;

END;
//
DELIMITER ;

-- PLUGIN DDL -> analytics-plugin -> report_churn_total_usd_monthly.ddl
drop table if exists report_churn_total_usd_monthly;
create table report_churn_total_usd_monthly (tenant_record_id int(11), day date, term varchar(50), count int(8));

-- PLUGIN DDL -> analytics-plugin -> report_churn_percent_monthly.ddl
drop table if exists report_churn_percent_monthly;
create table report_churn_percent_monthly (tenant_record_id int(11), day date, term varchar(50), count decimal(5,4));

-- PLUGIN DDL -> analytics-plugin -> refresh_report_churn_total_and_pct.prc
drop procedure if exists refresh_report_churn_total_and_pct;
DELIMITER //
CREATE PROCEDURE refresh_report_churn_total_and_pct()
BEGIN

    -- Refresh Churn Dollars and Churn Percent for MONTHLY subscriptions
    create temporary table report_temp_churn_monthly_paid_bundles (index (bundle_id)) as
       select distinct
         tenant_record_id
       , bundle_id
       from
         analytics_invoice_items
       where 1=1
         and invoice_original_amount_charged >0
         and invoice_balance = 0
    ;

    create temporary table report_temp_churn_monthly_paid_bundles2 (index (bundle_id)) as
       select distinct
         tenant_record_id
       , bundle_id
       from
         analytics_invoice_items
       where 1=1
         and invoice_original_amount_charged >0
         and invoice_balance = 0
    ;

    create temporary table report_temp_churn_monthly_dollars_pct_monthly as
    select
      active_sub_dollar.tenant_record_id
    , active_sub_dollar.month
    , round(churn_dollar.amount) churn_dollars_monthly
    , round(churn_dollar.amount / active_sub_dollar.amount,4) churn_pct_monthly
    from (
    select
      ast.tenant_record_id
    , date_format(next_start_date, '%Y-%m-01') month
    , prev_billing_period
    , sum(converted_prev_price) amount
    from
      analytics_subscription_transitions ast
      join report_temp_churn_monthly_paid_bundles paid_bundles on ast.bundle_id = paid_bundles.bundle_id and ast.tenant_record_id = paid_bundles.tenant_record_id
    where 1=1
      and report_group='default'
      and next_service='entitlement-service'
      and event like 'STOP_ENTITLEMENT%'
      and  prev_billing_period in ('MONTHLY')
    group by 1,2,3
    ) churn_dollar join (
    select
      ast.tenant_record_id
    , cal.d month
    , next_billing_period
    , sum(converted_next_price) amount
    from
      analytics_subscription_transitions ast
      join calendar cal  on next_start_date < cal.d and (next_end_date > cal.d or next_end_date is null )  and (cal.d = date_format(cal.d, '%Y-%m-01')) and cal.d>='2013-01-01' and cal.d < sysdate()
      join report_temp_churn_monthly_paid_bundles2 paid_bundles on ast.bundle_id = paid_bundles.bundle_id and ast.tenant_record_id = paid_bundles.tenant_record_id
    where 1=1
      and report_group='default'
      and next_service='entitlement-service'
      and event not like 'STOP_ENTITLEMENT%'
      and next_billing_period in ('MONTHLY')
    group by 1,2,3
    ) active_sub_dollar on churn_dollar.month=active_sub_dollar.month and churn_dollar.prev_billing_period=active_sub_dollar.next_billing_period and churn_dollar.tenant_record_id=active_sub_dollar.tenant_record_id
    ;

    DELETE FROM report_churn_total_usd_monthly;
    DELETE FROM report_churn_percent_monthly;

    insert into report_churn_total_usd_monthly
    select
      tenant_record_id
    , month day
    , 'MONTHLY'
    , churn_dollars_monthly count
    from
      report_temp_churn_monthly_dollars_pct_monthly
    ;

    insert into report_churn_percent_monthly
    select
      tenant_record_id
    , month day
    , 'MONTHLY'
    , churn_pct_monthly count
    from
      report_temp_churn_monthly_dollars_pct_monthly
    ;

    -- Refresh Churn Dollars and Churn Percent for ANNUAL subscriptions
    create temporary table report_temp_churn_annual_paid_bundles (index (bundle_id)) as
       select distinct
         tenant_record_id
       , bundle_id
       from (
           select
             tenant_record_id
           , bundle_id
           from
             analytics_invoice_items
           where 1=1
             and invoice_original_amount_charged >0
             and invoice_balance = 0
           union
           select
             s.tenant_record_id
           , s.bundle_id
           from
             subscription_events se
             join subscriptions s on se.subscription_id = s.id and se.tenant_record_id = s.tenant_record_id
           where 1=1
             and user_type in ('MIGRATE_ENTITLEMENT')
       ) bundles
    ;


    create temporary table report_temp_churn_annual_paid_bundles2 (index (bundle_id)) as
       select distinct
         tenant_record_id
       , bundle_id
       , charged_through_date
       from (
           select
             tenant_record_id
           , bundle_id
           , end_date charged_through_date
           from
             analytics_invoice_items
           where 1=1
             and invoice_original_amount_charged >0
             and invoice_balance = 0
           union
           select
             s.tenant_record_id
           , s.bundle_id
           , effective_date charged_through_date
           from
             subscription_events se
             join subscriptions s on se.subscription_id = s.id and se.tenant_record_id = s.tenant_record_id
           where 1=1
             and user_type in ('MIGRATE_ENTITLEMENT')
         ) bundles
    ;

    create temporary table report_temp_churn_annual_dollars_pct_monthly as
    select
      churn_dollar.tenant_record_id
    , churn_dollar.month
    , churn_dollar.amount churn_dollars_annual
    , round(churn_dollar.amount /active_sub_dollar.amount,4) churn_pct_annual
    from (
    select
      ast.tenant_record_id
    , date_format(next_start_date, '%Y-%m-01') month
    , prev_billing_period
    , round(sum(converted_prev_price)) amount
    from
      analytics_subscription_transitions ast
      join report_temp_churn_annual_paid_bundles paid_bundles on ast.bundle_id = paid_bundles.bundle_id and ast.tenant_record_id = paid_bundles.tenant_record_id
    where 1=1
      and report_group='default'
      and next_service='entitlement-service'
      and event like 'STOP_ENTITLEMENT%'
      and prev_billing_period in ('ANNUAL')
    group by 1,2,3
    ) churn_dollar join (
    select
      ast.tenant_record_id
    , cal.d month
    , next_billing_period
    , round(sum(converted_next_price)) amount
    from
      analytics_subscription_transitions ast
      join calendar cal  on next_start_date < cal.d and (next_end_date > cal.d or next_end_date is null )  and (cal.d = date_format(cal.d, '%Y-%m-01')) and cal.d>='2013-01-01' and cal.d < sysdate()
      join report_temp_churn_annual_paid_bundles2 paid_bundles on ast.bundle_id = paid_bundles.bundle_id and ast.tenant_record_id = paid_bundles.tenant_record_id
    where 1=1
      and report_group='default'
      and next_service='entitlement-service'
      and event not like 'STOP_ENTITLEMENT%'
      and next_billing_period in ('ANNUAL')
      and extract(month from date_add(charged_through_date,interval 1 day)) = extract(month from cal.d)
    group by 1,2,3
    ) active_sub_dollar on churn_dollar.month=active_sub_dollar.month and churn_dollar.prev_billing_period=active_sub_dollar.next_billing_period and churn_dollar.tenant_record_id=active_sub_dollar.tenant_record_id
    ;

    insert into report_churn_total_usd_monthly
    select
      tenant_record_id
    , month day
    , 'ANNUAL'
    , churn_dollars_annual count
    from
      report_temp_churn_annual_dollars_pct_monthly
    ;

    insert into report_churn_percent_monthly
    select
      tenant_record_id
    , month day
    , 'ANNUAL'
    , churn_pct_annual count
    from
      report_temp_churn_annual_dollars_pct_monthly
    ;


END;
//
DELIMITER ;


-- PLUGIN DDL -> killbill-email-notifications-plugin

-- PLUGIN DDL -> killbill-email-notifications-plugin -> ddl.sql
DROP table If exists email_notifications_configuration;
CREATE TABLE email_notifications_configuration (
  record_id serial unique,
  kb_account_id varchar(255) NOT NULL,
  kb_tenant_id varchar(255) NOT NULL,
  event_type varchar(255) NOT NULL,
  created_at datetime NOT NULL,
  PRIMARY KEY (record_id)
) ;
CREATE UNIQUE INDEX email_notifications_configuration_event_type_kb_account_id ON email_notifications_configuration(event_type, kb_account_id);
CREATE INDEX email_notifications_configuration_kb_account_id ON email_notifications_configuration(kb_account_id);
CREATE INDEX email_notifications_configuration_kb_tenant_id ON email_notifications_configuration(kb_tenant_id);
CREATE INDEX email_notifications_configuration_event_type_kb_tenant_id ON email_notifications_configuration(event_type, kb_tenant_id);


-- PLUGIN DDL -> stripe-plugin
drop table if exists stripe_hpp_requests;
drop table if exists stripe_responses;
drop table if exists stripe_payment_methods;

-- PLUGIN DDL -> stripe-plugin -> ddl.sql
;

create table stripe_hpp_requests (
  record_id serial
, kb_account_id char(36) not null
, kb_payment_id char(36) default null
, kb_payment_transaction_id char(36) default null
, session_id varchar(255) not null
, additional_data longtext default null
, created_date datetime not null
, kb_tenant_id char(36) not null
, primary key(record_id)
) ;
create index stripe_hpp_requests_kb_account_id on stripe_hpp_requests(kb_account_id);
create unique index stripe_hpp_requests_kb_session_id on stripe_hpp_requests(session_id);
create index stripe_hpp_requests_kb_payment_transaction_id on stripe_hpp_requests(kb_payment_transaction_id);

create table stripe_responses (
  record_id serial
, kb_account_id char(36) not null
, kb_payment_id char(36) not null
, kb_payment_transaction_id char(36) not null
, transaction_type varchar(32) not null
, amount numeric(15,9)
, currency char(3)
, stripe_id varchar(255) not null
, additional_data longtext default null
, created_date datetime not null
, kb_tenant_id char(36) not null
, primary key(record_id)
) ;
create index stripe_responses_kb_payment_id on stripe_responses(kb_payment_id);
create index stripe_responses_kb_payment_transaction_id on stripe_responses(kb_payment_transaction_id);
create index stripe_responses_stripe_id on stripe_responses(stripe_id);

create table stripe_payment_methods (
  record_id serial
, kb_account_id char(36) not null
, kb_payment_method_id char(36) not null
, stripe_id varchar(255) not null
, is_default smallint not null default 0
, is_deleted smallint not null default 0
, additional_data longtext default null
, created_date datetime not null
, updated_date datetime not null
, kb_tenant_id char(36) not null
, primary key(record_id)
) ;
create unique index stripe_payment_methods_kb_payment_id on stripe_payment_methods(kb_payment_method_id);
create index stripe_payment_methods_stripe_id on stripe_payment_methods(stripe_id);

