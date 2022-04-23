 -- SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
 -- SPDX-License-Identifier: Apache-2.0
-- KILLBILL DDL
-- https://docs.killbill.io/0.22/ddl.sql

USE killbill;

DROP TABLE IF EXISTS accounts;
CREATE TABLE accounts (
    record_id serial unique,
    id varchar(36) NOT NULL,
    external_key varchar(255) NOT NULL,
    email varchar(128) DEFAULT NULL,
    name varchar(100) DEFAULT NULL,
    first_name_length int DEFAULT NULL,
    currency varchar(3) DEFAULT NULL,
    billing_cycle_day_local int DEFAULT NULL,
    parent_account_id varchar(36) DEFAULT NULL,
    is_payment_delegated_to_parent boolean DEFAULT FALSE,
    payment_method_id varchar(36) DEFAULT NULL,
    reference_time datetime NOT NULL,
    time_zone varchar(50) NOT NULL,
    locale varchar(5) DEFAULT NULL,
    address1 varchar(100) DEFAULT NULL,
    address2 varchar(100) DEFAULT NULL,
    company_name varchar(50) DEFAULT NULL,
    city varchar(50) DEFAULT NULL,
    state_or_province varchar(50) DEFAULT NULL,
    country varchar(50) DEFAULT NULL,
    postal_code varchar(16) DEFAULT NULL,
    phone varchar(25) DEFAULT NULL,
    notes varchar(4096) DEFAULT NULL,
    migrated boolean default false,
    created_date datetime NOT NULL,
    created_by varchar(50) NOT NULL,
    updated_date datetime DEFAULT NULL,
    updated_by varchar(50) DEFAULT NULL,
    tenant_record_id bigint not null default 0,
    PRIMARY KEY(record_id)
);
CREATE UNIQUE INDEX accounts_id ON accounts(id);
CREATE UNIQUE INDEX accounts_external_key ON accounts(external_key, tenant_record_id);
CREATE INDEX accounts_parents ON accounts(parent_account_id);
CREATE INDEX accounts_tenant_record_id ON accounts(tenant_record_id);
CREATE INDEX accounts_email_tenant_record_id ON accounts(email, tenant_record_id);
CREATE INDEX accounts_company_name_tenant_record_id ON accounts(company_name, tenant_record_id);
CREATE INDEX accounts_name_tenant_record_id ON accounts(name, tenant_record_id);


DROP TABLE IF EXISTS account_history;
CREATE TABLE account_history (
    record_id serial unique,
    id varchar(36) NOT NULL,
    target_record_id bigint not null,
    external_key varchar(255) NOT NULL,
    email varchar(128) DEFAULT NULL,
    name varchar(100) DEFAULT NULL,
    first_name_length int DEFAULT NULL,
    currency varchar(3) DEFAULT NULL,
    billing_cycle_day_local int DEFAULT NULL,
    parent_account_id varchar(36) DEFAULT NULL,
    is_payment_delegated_to_parent boolean default false,
    payment_method_id varchar(36) DEFAULT NULL,
    reference_time datetime NOT NULL,
    time_zone varchar(50) NOT NULL,
    locale varchar(5) DEFAULT NULL,
    address1 varchar(100) DEFAULT NULL,
    address2 varchar(100) DEFAULT NULL,
    company_name varchar(50) DEFAULT NULL,
    city varchar(50) DEFAULT NULL,
    state_or_province varchar(50) DEFAULT NULL,
    country varchar(50) DEFAULT NULL,
    postal_code varchar(16) DEFAULT NULL,
    phone varchar(25) DEFAULT NULL,
    notes varchar(4096) DEFAULT NULL,
    migrated boolean default false,
    change_type varchar(6) NOT NULL,
    created_by varchar(50) NOT NULL,
    created_date datetime NOT NULL,
    updated_by varchar(50) NOT NULL,
    updated_date datetime NOT NULL,
    tenant_record_id bigint not null default 0,
    PRIMARY KEY(record_id)
);
CREATE INDEX account_history_target_record_id ON account_history(target_record_id);
CREATE INDEX account_history_tenant_record_id ON account_history(tenant_record_id);

DROP TABLE IF EXISTS account_emails;
CREATE TABLE account_emails (
    record_id serial unique,
    id varchar(36) NOT NULL,
    account_id varchar(36) NOT NULL,
    email varchar(128) NOT NULL,
    is_active boolean default true,
    created_by varchar(50) NOT NULL,
    created_date datetime NOT NULL,
    updated_by varchar(50) NOT NULL,
    updated_date datetime NOT NULL,
    account_record_id bigint not null,
    tenant_record_id bigint not null default 0,
    PRIMARY KEY(record_id)
);
CREATE UNIQUE INDEX account_email_id ON account_emails(id);
CREATE INDEX account_email_account_id_email ON account_emails(account_id, email);
CREATE INDEX account_emails_tenant_account_record_id ON account_emails(tenant_record_id, account_record_id);

DROP TABLE IF EXISTS account_email_history;
CREATE TABLE account_email_history (
    record_id serial unique,
    id varchar(36) NOT NULL,
    target_record_id bigint not null,
    account_id varchar(36) NOT NULL,
    email varchar(128) NOT NULL,
    is_active boolean default true,
    change_type varchar(6) NOT NULL,
    created_by varchar(50) NOT NULL,
    created_date datetime NOT NULL,
    updated_by varchar(50) NOT NULL,
    updated_date datetime NOT NULL,
    account_record_id bigint not null,
    tenant_record_id bigint not null default 0,
    PRIMARY KEY(record_id)
);
CREATE INDEX account_email_target_record_id ON account_email_history(target_record_id);
CREATE INDEX account_email_history_tenant_account_record_id ON account_email_history(tenant_record_id, account_record_id);



DROP TABLE IF EXISTS bus_ext_events;
CREATE TABLE bus_ext_events (
    record_id serial unique,
    class_name varchar(128) NOT NULL,
    event_json text NOT NULL,
    user_token varchar(36),
    created_date datetime NOT NULL,
    creating_owner varchar(50) NOT NULL,
    processing_owner varchar(50) DEFAULT NULL,
    processing_available_date datetime DEFAULT NULL,
    processing_state varchar(14) DEFAULT 'AVAILABLE',
    error_count int DEFAULT 0,
    /* Note: account_record_id can be NULL (e.g. TagDefinition events) */
    search_key1 bigint default null,
    search_key2 bigint not null default 0,
    PRIMARY KEY(record_id)
);
CREATE INDEX idx_bus_ext_where ON bus_ext_events (processing_state, processing_owner, processing_available_date);
CREATE INDEX bus_ext_events_tenant_account_record_id ON bus_ext_events(search_key2, search_key1);

DROP TABLE IF EXISTS bus_ext_events_history;
CREATE TABLE bus_ext_events_history (
    record_id serial unique,
    class_name varchar(128) NOT NULL,
    event_json text NOT NULL,
    user_token varchar(36),
    created_date datetime NOT NULL,
    creating_owner varchar(50) NOT NULL,
    processing_owner varchar(50) DEFAULT NULL,
    processing_available_date datetime DEFAULT NULL,
    processing_state varchar(14) DEFAULT 'AVAILABLE',
    error_count int DEFAULT 0,
    /* Note: account_record_id can be NULL (e.g. TagDefinition events) */
    search_key1 bigint default null,
    search_key2 bigint not null default 0,
    PRIMARY KEY(record_id)
);
CREATE INDEX bus_ext_events_history_tenant_account_record_id ON bus_ext_events_history(search_key2, search_key1);



DROP TABLE IF EXISTS catalog_override_plan_definition;
CREATE TABLE catalog_override_plan_definition (
    record_id serial unique,
    parent_plan_name varchar(255) NOT NULL,
    effective_date datetime NOT NULL,
    is_active boolean default true,
    created_date datetime NOT NULL,
    created_by varchar(50) NOT NULL,
    tenant_record_id bigint not null default 0,
    PRIMARY KEY(record_id)
);
CREATE INDEX catalog_override_plan_definition_tenant_record_id ON catalog_override_plan_definition(tenant_record_id);


DROP TABLE IF EXISTS catalog_override_phase_definition;
CREATE TABLE catalog_override_phase_definition (
    record_id serial unique,
    parent_phase_name varchar(255) NOT NULL,
    currency varchar(3) NOT NULL,
    fixed_price numeric(15,9) NULL,
    recurring_price numeric(15,9) NULL,
    effective_date datetime NOT NULL,
    created_date datetime NOT NULL,
    created_by varchar(50) NOT NULL,
    tenant_record_id bigint not null default 0,
    PRIMARY KEY(record_id)
);
CREATE INDEX catalog_override_phase_definition_idx ON catalog_override_phase_definition(tenant_record_id, parent_phase_name, currency);

DROP TABLE IF EXISTS catalog_override_plan_phase;
CREATE TABLE catalog_override_plan_phase (
    record_id serial unique,
    phase_number int NOT NULL,
    phase_def_record_id bigint not null,
    target_plan_def_record_id bigint not null,
    created_date datetime NOT NULL,
    created_by varchar(50) NOT NULL,
    tenant_record_id bigint not null default 0,
    PRIMARY KEY(record_id)
);
CREATE INDEX catalog_override_plan_phase_idx ON catalog_override_plan_phase(tenant_record_id, phase_number, phase_def_record_id);

DROP TABLE IF EXISTS catalog_override_usage_definition;
create table catalog_override_usage_definition
(
record_id serial unique,
parent_usage_name varchar(255) NOT NULL,
type varchar(255) NOT NULL,
fixed_price decimal(15,9) NULL,
recurring_price decimal(15,9) NULL,
currency varchar(3) NOT NULL,
effective_date datetime NOT NULL,
created_date datetime NOT NULL,
created_by varchar(50) NOT NULL,
tenant_record_id bigint not null default 0,
PRIMARY KEY(record_id)
);
CREATE INDEX catalog_override_usage_definition_idx ON catalog_override_usage_definition(tenant_record_id, parent_usage_name, currency);


DROP TABLE IF EXISTS catalog_override_tier_definition;
create table catalog_override_tier_definition
(
record_id serial unique,
fixed_price decimal(15,9) NULL,
recurring_price decimal(15,9) NULL,
currency varchar(3) NOT NULL,
effective_date datetime NOT NULL,
created_date datetime NOT NULL,
created_by varchar(50) NOT NULL,
tenant_record_id bigint not null default 0,
PRIMARY KEY(record_id)
);
CREATE INDEX catalog_override_tier_definition_idx ON catalog_override_tier_definition(tenant_record_id, currency);

DROP TABLE IF EXISTS catalog_override_block_definition;
create table catalog_override_block_definition
(
record_id serial unique,
parent_unit_name varchar(255) NOT NULL,
bsize decimal(15,9) NOT NULL,
max decimal(15,9) NULL,
currency varchar(3) NOT NULL,
price decimal(15,9) NOT NULL,
effective_date datetime NOT NULL,
created_date datetime NOT NULL,
created_by varchar(50) NOT NULL,
tenant_record_id bigint not null default 0,
PRIMARY KEY(record_id)
);
CREATE INDEX catalog_override_block_definition_idx ON catalog_override_block_definition(tenant_record_id, parent_unit_name, currency);


DROP TABLE IF EXISTS catalog_override_phase_usage;
create table catalog_override_phase_usage
(
record_id serial unique,
usage_number int,
usage_def_record_id  bigint not null,
target_phase_def_record_id bigint not null,
created_date datetime NOT NULL,
created_by varchar(50) NOT NULL,
tenant_record_id bigint not null default 0,
PRIMARY KEY(record_id)
);
CREATE INDEX catalog_override_phase_usage_idx ON catalog_override_phase_usage(tenant_record_id, usage_number, usage_def_record_id);

DROP TABLE IF EXISTS catalog_override_usage_tier;
create table catalog_override_usage_tier
(
record_id serial unique,
tier_number int,
tier_def_record_id bigint not null,
target_usage_def_record_id bigint not null,
created_date datetime NOT NULL,
created_by varchar(50) NOT NULL,
tenant_record_id bigint not null default 0,
PRIMARY KEY(record_id)
);
CREATE INDEX catalog_override_usage_tier_idx ON catalog_override_usage_tier(tenant_record_id, tier_number, tier_def_record_id);


DROP TABLE IF EXISTS catalog_override_tier_block;
create table catalog_override_tier_block
(
record_id serial unique,
block_number int,
block_def_record_id bigint not null,
target_tier_def_record_id bigint not null,
created_date datetime NOT NULL,
created_by varchar(50) NOT NULL,
tenant_record_id bigint NOT NULL default 0,
PRIMARY KEY(record_id)
);
CREATE INDEX catalog_override_tier_block_idx ON catalog_override_tier_block(tenant_record_id, block_number, block_def_record_id);





DROP TABLE IF EXISTS subscription_events;
CREATE TABLE subscription_events (
    record_id serial unique,
    id varchar(36) NOT NULL,
    event_type varchar(15) NOT NULL,
    user_type varchar(25) DEFAULT NULL,
    effective_date datetime NOT NULL,
    subscription_id varchar(36) NOT NULL,
    plan_name varchar(255) DEFAULT NULL,
    phase_name varchar(255) DEFAULT NULL,
    price_list_name varchar(64) DEFAULT NULL,
    billing_cycle_day_local int DEFAULT NULL,
    is_active boolean default true,
    created_by varchar(50) NOT NULL,
    created_date datetime NOT NULL,
    updated_by varchar(50) NOT NULL,
    updated_date datetime NOT NULL,
    account_record_id bigint not null,
    tenant_record_id bigint not null default 0,
    PRIMARY KEY(record_id)
);
CREATE UNIQUE INDEX subscription_events_id ON subscription_events(id);
CREATE INDEX idx_ent_1 ON subscription_events(subscription_id, is_active, effective_date);
CREATE INDEX idx_ent_2 ON subscription_events(subscription_id, effective_date, created_date, id);
CREATE INDEX subscription_events_tenant_account_record_id ON subscription_events(tenant_record_id, account_record_id);


DROP TABLE IF EXISTS subscription_event_history;
CREATE TABLE subscription_event_history (
    record_id serial unique,
    id varchar(36) NOT NULL,
    target_record_id bigint not null,
    event_type varchar(15) NOT NULL,
    user_type varchar(25) DEFAULT NULL,
    effective_date datetime NOT NULL,
    subscription_id varchar(36) NOT NULL,
    plan_name varchar(255) DEFAULT NULL,
    phase_name varchar(255) DEFAULT NULL,
    price_list_name varchar(64) DEFAULT NULL,
    billing_cycle_day_local int DEFAULT NULL,
    is_active boolean default true,
    change_type varchar(6) NOT NULL,
    created_by varchar(50) NOT NULL,
    created_date datetime NOT NULL,
    updated_by varchar(50) NOT NULL,
    updated_date datetime NOT NULL,
    account_record_id bigint not null,
    tenant_record_id bigint not null default 0,
    PRIMARY KEY(record_id)
);
CREATE INDEX subscription_event_history_target_record_id ON subscription_event_history(target_record_id);
CREATE INDEX subscription_event_history_tenant_record_id ON subscription_event_history(tenant_record_id);



DROP TABLE IF EXISTS subscriptions;
CREATE TABLE subscriptions (
    record_id serial unique,
    id varchar(36) NOT NULL,
    bundle_id varchar(36) NOT NULL,
    external_key varchar(255) NOT NULL,
    category varchar(32) NOT NULL,
    start_date datetime NOT NULL,
    bundle_start_date datetime NOT NULL,
    charged_through_date datetime DEFAULT NULL,
    migrated bool NOT NULL default FALSE,
    created_by varchar(50) NOT NULL,
    created_date datetime NOT NULL,
    updated_by varchar(50) NOT NULL,
    updated_date datetime NOT NULL,
    account_record_id bigint not null,
    tenant_record_id bigint not null default 0,
    PRIMARY KEY(record_id)
);
CREATE UNIQUE INDEX subscriptions_id ON subscriptions(id);
CREATE UNIQUE INDEX subscriptions_external_key ON subscriptions(external_key, tenant_record_id);
CREATE INDEX subscriptions_bundle_id ON subscriptions(bundle_id);
CREATE INDEX subscriptions_tenant_account_record_id ON subscriptions(tenant_record_id, account_record_id);

DROP TABLE IF EXISTS subscription_history;
CREATE TABLE subscription_history (
    record_id serial unique,
    id varchar(36) NOT NULL,
    target_record_id bigint not null,
    bundle_id varchar(36) NOT NULL,
    external_key varchar(255) NOT NULL,
    category varchar(32) NOT NULL,
    start_date datetime NOT NULL,
    bundle_start_date datetime NOT NULL,
    charged_through_date datetime DEFAULT NULL,
    migrated bool NOT NULL default FALSE,
    change_type varchar(6) NOT NULL,
    created_by varchar(50) NOT NULL,
    created_date datetime NOT NULL,
    updated_by varchar(50) NOT NULL,
    updated_date datetime NOT NULL,
    account_record_id bigint not null,
    tenant_record_id bigint not null default 0,
    PRIMARY KEY(record_id)
);
CREATE INDEX subscription_history_target_record_id ON subscription_history(target_record_id);
CREATE INDEX subscription_history_tenant_record_id ON subscription_history(tenant_record_id);



DROP TABLE IF EXISTS bundles;
CREATE TABLE bundles (
    record_id serial unique,
    id varchar(36) NOT NULL,
    external_key varchar(255) NOT NULL,
    account_id varchar(36) NOT NULL,
    last_sys_update_date datetime,
    original_created_date datetime NOT NULL,
    created_by varchar(50) NOT NULL,
    created_date datetime NOT NULL,
    updated_by varchar(50) NOT NULL,
    updated_date datetime NOT NULL,
    account_record_id bigint not null,
    tenant_record_id bigint not null default 0,
    PRIMARY KEY(record_id)
);
CREATE UNIQUE INDEX bundles_id ON bundles(id);
CREATE UNIQUE INDEX bundles_external_key ON bundles(external_key, tenant_record_id);
CREATE INDEX bundles_account ON bundles(account_id);
CREATE INDEX bundles_tenant_account_record_id ON bundles(tenant_record_id, account_record_id);

DROP TABLE IF EXISTS bundle_history;
CREATE TABLE bundle_history (
    record_id serial unique,
    id varchar(36) NOT NULL,
    target_record_id bigint not null,
    external_key varchar(255) NOT NULL,
    account_id varchar(36) NOT NULL,
    last_sys_update_date datetime,
    original_created_date datetime NOT NULL,
    change_type varchar(6) NOT NULL,
    created_by varchar(50) NOT NULL,
    created_date datetime NOT NULL,
    updated_by varchar(50) NOT NULL,
    updated_date datetime NOT NULL,
    account_record_id bigint not null,
    tenant_record_id bigint not null default 0,
    PRIMARY KEY(record_id)
);
CREATE INDEX bundle_history_target_record_id ON bundle_history(target_record_id);
CREATE INDEX bundle_history_tenant_record_id ON bundle_history(tenant_record_id);



DROP TABLE IF EXISTS blocking_states;
CREATE TABLE blocking_states (
    record_id serial unique,
    id varchar(36) NOT NULL,
    blockable_id varchar(36) NOT NULL,
    type varchar(20) NOT NULL,
    state varchar(50) NOT NULL,
    service varchar(20) NOT NULL,
    block_change bool NOT NULL,
    block_entitlement bool NOT NULL,
    block_billing bool NOT NULL,
    effective_date datetime NOT NULL,
    is_active boolean default true,
    created_date datetime NOT NULL,
    created_by varchar(50) NOT NULL,
    updated_date datetime DEFAULT NULL,
    updated_by varchar(50) DEFAULT NULL,
    account_record_id bigint not null,
    tenant_record_id bigint not null default 0,
    PRIMARY KEY(record_id)
);
CREATE INDEX blocking_states_id ON blocking_states(blockable_id);
CREATE INDEX blocking_states_id_real ON blocking_states(id);
CREATE INDEX blocking_states_tenant_account_record_id ON blocking_states(tenant_record_id, account_record_id);

DROP TABLE IF EXISTS blocking_state_history;
CREATE TABLE blocking_state_history (
    record_id serial unique,
    id varchar(36) NOT NULL,
    target_record_id bigint not null,
    blockable_id varchar(36) NOT NULL,
    type varchar(20) NOT NULL,
    state varchar(50) NOT NULL,
    service varchar(20) NOT NULL,
    block_change bool NOT NULL,
    block_entitlement bool NOT NULL,
    block_billing bool NOT NULL,
    effective_date datetime NOT NULL,
    is_active boolean default true,
    change_type varchar(6) NOT NULL,
    created_date datetime NOT NULL,
    created_by varchar(50) NOT NULL,
    updated_date datetime DEFAULT NULL,
    updated_by varchar(50) DEFAULT NULL,
    account_record_id bigint not null,
    tenant_record_id bigint not null default 0,
    PRIMARY KEY(record_id)
);
CREATE INDEX blocking_state_history_target_record_id ON blocking_state_history(target_record_id);
CREATE INDEX blocking_state_history_tenant_record_id ON blocking_state_history(tenant_record_id);


DROP TABLE IF EXISTS invoice_tracking_ids;
CREATE TABLE invoice_tracking_ids (
    record_id serial unique,
    id varchar(36) NOT NULL,
    tracking_id varchar(128) NOT NULL,
    invoice_id varchar(36) NOT NULL,
    subscription_id varchar(36),
    unit_type varchar(255) NOT NULL,
    record_date date NOT NULL,
    is_active boolean default true,
    created_by varchar(50) NOT NULL,
    created_date datetime NOT NULL,
    updated_by varchar(50) NOT NULL,
    updated_date datetime NOT NULL,
    account_record_id bigint not null,
    tenant_record_id bigint not null default 0,
    PRIMARY KEY(record_id)
);
CREATE INDEX invoice_tracking_tenant_account_date_idx ON invoice_tracking_ids(tenant_record_id, account_record_id, record_date);
CREATE INDEX invoice_tracking_invoice_id_idx ON invoice_tracking_ids(invoice_id);
CREATE INDEX invoice_tracking_id_idx ON invoice_tracking_ids(id);


DROP TABLE IF EXISTS invoice_tracking_id_history;
CREATE TABLE invoice_tracking_id_history (
    record_id serial unique,
    id varchar(36) NOT NULL,
    target_record_id bigint not null,
    tracking_id varchar(128) NOT NULL,
    invoice_id varchar(36) NOT NULL,
    subscription_id varchar(36),
    unit_type varchar(255) NOT NULL,
    record_date date NOT NULL,
    is_active boolean default true,
    change_type varchar(6) NOT NULL,
    created_by varchar(50) NOT NULL,
    created_date datetime NOT NULL,
    updated_by varchar(50) NOT NULL,
    updated_date datetime NOT NULL,
    account_record_id bigint not null,
    tenant_record_id bigint not null default 0,
    PRIMARY KEY(record_id)
);
CREATE INDEX invoice_tracking_id_history_target_record_id ON invoice_tracking_id_history(target_record_id);
CREATE INDEX invoice_tracking_id_history_tenant_record_id ON invoice_tracking_id_history(tenant_record_id);

DROP TABLE IF EXISTS invoice_items;
CREATE TABLE invoice_items (
    record_id serial unique,
    id varchar(36) NOT NULL,
    type varchar(24) NOT NULL,
    invoice_id varchar(36) NOT NULL,
    account_id varchar(36) NOT NULL,
    child_account_id varchar(36),
    bundle_id varchar(36),
    subscription_id varchar(36),
    description varchar(255),
    product_name varchar(255),
    plan_name varchar(255),
    phase_name varchar(255),
    usage_name varchar(255),
    catalog_effective_date datetime,
    start_date date,
    end_date date,
    amount numeric(15,9) NOT NULL,
    rate numeric(15,9) NULL,
    currency varchar(3) NOT NULL,
    linked_item_id varchar(36),
    quantity int,
    item_details text,
    created_by varchar(50) NOT NULL,
    created_date datetime NOT NULL,
    account_record_id bigint not null,
    tenant_record_id bigint not null default 0,
    PRIMARY KEY(record_id)
);
CREATE UNIQUE INDEX invoice_items_id ON invoice_items(id);
CREATE INDEX invoice_items_subscription_id ON invoice_items(subscription_id ASC);
CREATE INDEX invoice_items_invoice_id ON invoice_items(invoice_id ASC);
CREATE INDEX invoice_items_account_id ON invoice_items(account_id ASC);
CREATE INDEX invoice_items_linked_item_id ON invoice_items(linked_item_id ASC);
CREATE INDEX invoice_items_tenant_account_record_id ON invoice_items(tenant_record_id, account_record_id);


DROP TABLE IF EXISTS invoice_item_history;
CREATE TABLE invoice_item_history (
    record_id serial unique,
    id varchar(36) NOT NULL,
    target_record_id bigint not null,
    type varchar(24) NOT NULL,
    invoice_id varchar(36) NOT NULL,
    account_id varchar(36) NOT NULL,
    child_account_id varchar(36),
    bundle_id varchar(36),
    subscription_id varchar(36),
    description varchar(255),
    product_name varchar(255),
    plan_name varchar(255),
    phase_name varchar(255),
    usage_name varchar(255),
    catalog_effective_date datetime,
    start_date date,
    end_date date,
    amount numeric(15,9) NOT NULL,
    rate numeric(15,9) NULL,
    currency varchar(3) NOT NULL,
    linked_item_id varchar(36),
    quantity int,
    item_details text,
    change_type varchar(6) NOT NULL,
    created_by varchar(50) NOT NULL,
    created_date datetime NOT NULL,
    account_record_id bigint not null,
    tenant_record_id bigint not null default 0,
    PRIMARY KEY(record_id)
);
CREATE INDEX invoice_item_history_target_record_id ON invoice_item_history(target_record_id);
CREATE INDEX invoice_item_history_tenant_record_id ON invoice_item_history(tenant_record_id);



DROP TABLE IF EXISTS invoices;
CREATE TABLE invoices (
    record_id serial unique,
    id varchar(36) NOT NULL,
    account_id varchar(36) NOT NULL,
    invoice_date date NOT NULL,
    target_date date,
    currency varchar(3) NOT NULL,
    status varchar(15) NOT NULL DEFAULT 'COMMITTED',
    migrated bool NOT NULL,
    parent_invoice bool NOT NULL DEFAULT FALSE,
    created_by varchar(50) NOT NULL,
    created_date datetime NOT NULL,
    account_record_id bigint not null,
    tenant_record_id bigint not null default 0,
    PRIMARY KEY(record_id)
);
CREATE UNIQUE INDEX invoices_id ON invoices(id);
CREATE INDEX invoices_account ON invoices(account_id ASC);
CREATE INDEX invoices_tenant_account_record_id ON invoices(tenant_record_id, account_record_id);


DROP TABLE IF EXISTS invoice_history;
CREATE TABLE invoice_history (
    record_id serial unique,
    id varchar(36) NOT NULL,
    target_record_id bigint not null,
    account_id varchar(36) NOT NULL,
    invoice_date date NOT NULL,
    target_date date,
    currency varchar(3) NOT NULL,
    status varchar(15) NOT NULL DEFAULT 'COMMITTED',
    migrated bool NOT NULL,
    parent_invoice bool NOT NULL DEFAULT FALSE,
    change_type varchar(6) NOT NULL,
    created_by varchar(50) NOT NULL,
    created_date datetime NOT NULL,
    account_record_id bigint not null,
    tenant_record_id bigint not null default 0,
    PRIMARY KEY(record_id)
);
CREATE INDEX invoice_history_target_record_id ON invoice_history(target_record_id);
CREATE INDEX invoice_history_tenant_record_id ON invoice_history(tenant_record_id);


DROP TABLE IF EXISTS invoice_payments;
CREATE TABLE invoice_payments (
    record_id serial unique,
    id varchar(36) NOT NULL,
    type varchar(24) NOT NULL,
    invoice_id varchar(36) NOT NULL,
    payment_id varchar(36),
    payment_date datetime NOT NULL,
    amount numeric(15,9) NOT NULL,
    currency varchar(3) NOT NULL,
    processed_currency varchar(3) NOT NULL,
    payment_cookie_id varchar(255) DEFAULT NULL,
    linked_invoice_payment_id varchar(36) DEFAULT NULL,
    success bool DEFAULT true,
    created_by varchar(50) NOT NULL,
    created_date datetime NOT NULL,
    account_record_id bigint not null,
    tenant_record_id bigint not null default 0,
    PRIMARY KEY(record_id)
);
CREATE UNIQUE INDEX invoice_payments_id ON invoice_payments(id);
CREATE INDEX invoice_payments_invoice_id ON invoice_payments(invoice_id);
CREATE INDEX invoice_payments_reversals ON invoice_payments(linked_invoice_payment_id);
CREATE INDEX invoice_payments_payment_id ON invoice_payments(payment_id);
CREATE INDEX invoice_payments_payment_cookie_id ON invoice_payments(payment_cookie_id);
CREATE INDEX invoice_payments_tenant_account_record_id ON invoice_payments(tenant_record_id, account_record_id);

DROP TABLE IF EXISTS invoice_payment_history;
CREATE TABLE invoice_payment_history (
    record_id serial unique,
    id varchar(36) NOT NULL,
    target_record_id bigint not null,
    type varchar(24) NOT NULL,
    invoice_id varchar(36) NOT NULL,
    payment_id varchar(36),
    payment_date datetime NOT NULL,
    amount numeric(15,9) NOT NULL,
    currency varchar(3) NOT NULL,
    processed_currency varchar(3) NOT NULL,
    payment_cookie_id varchar(255) DEFAULT NULL,
    linked_invoice_payment_id varchar(36) DEFAULT NULL,
    success bool DEFAULT true,
    change_type varchar(6) NOT NULL,
    created_by varchar(50) NOT NULL,
    created_date datetime NOT NULL,
    account_record_id bigint not null,
    tenant_record_id bigint not null default 0,
    PRIMARY KEY(record_id)
);
CREATE INDEX invoice_payment_history_target_record_id ON invoice_payment_history(target_record_id);
CREATE INDEX invoice_payment_history_tenant_record_id ON invoice_payment_history(tenant_record_id);


DROP TABLE IF EXISTS invoice_parent_children;
CREATE TABLE invoice_parent_children (
    record_id serial unique,
    id varchar(36) NOT NULL,
    parent_invoice_id varchar(36) NOT NULL,
    child_invoice_id varchar(36) NOT NULL,
    child_account_id varchar(36) NOT NULL,
    created_by varchar(50) NOT NULL,
    created_date datetime NOT NULL,
    account_record_id bigint not null,
    tenant_record_id bigint not null default 0,
    PRIMARY KEY(record_id)
);
CREATE UNIQUE INDEX invoice_parent_children_id ON invoice_parent_children(id);
CREATE INDEX invoice_parent_children_invoice_id ON invoice_parent_children(parent_invoice_id);
CREATE INDEX invoice_parent_children_tenant_account_record_id ON invoice_parent_children(tenant_record_id, account_record_id);
CREATE INDEX invoice_parent_children_child_invoice_id ON invoice_parent_children(child_invoice_id);

DROP TABLE IF EXISTS invoice_billing_events;
CREATE TABLE invoice_billing_events (
    record_id serial unique,
    id varchar(36) NOT NULL,
    invoice_id varchar(36) NOT NULL,
	billing_events blob NOT NULL,
    created_by varchar(50) NOT NULL,
    created_date datetime NOT NULL,
    account_record_id bigint not null,
    tenant_record_id bigint not null default 0,
    PRIMARY KEY(record_id)
);
CREATE UNIQUE INDEX invoice_billing_events_invoice_id ON invoice_billing_events(invoice_id);



DROP TABLE IF EXISTS payment_attempts;
CREATE TABLE payment_attempts (
    record_id serial unique,
    id varchar(36) NOT NULL,
    account_id varchar(36) NOT NULL,
    payment_method_id varchar(36) DEFAULT NULL,
    payment_external_key varchar(255) NOT NULL,
    transaction_id varchar(36),
    transaction_external_key varchar(255) NOT NULL,
    transaction_type varchar(32) NOT NULL,
    state_name varchar(32) NOT NULL,
    amount numeric(15,9),
    currency varchar(3),
    plugin_name varchar(1024) NOT NULL,
    plugin_properties mediumblob,
    created_by varchar(50) NOT NULL,
    created_date datetime NOT NULL,
    updated_by varchar(50) NOT NULL,
    updated_date datetime NOT NULL,
    account_record_id bigint not null,
    tenant_record_id bigint not null default 0,
    PRIMARY KEY (record_id)
);
CREATE UNIQUE INDEX payment_attempts_id ON payment_attempts(id);
CREATE INDEX payment_attempts_payment ON payment_attempts(transaction_id);
CREATE INDEX payment_attempts_payment_key ON payment_attempts(payment_external_key);
CREATE INDEX payment_attempts_payment_state ON payment_attempts(state_name);
CREATE INDEX payment_attempts_payment_transaction_key ON payment_attempts(transaction_external_key);
CREATE INDEX payment_attempts_tenant_account_record_id ON payment_attempts(tenant_record_id, account_record_id);

DROP TABLE IF EXISTS payment_attempt_history;
CREATE TABLE payment_attempt_history (
    record_id serial unique,
    id varchar(36) NOT NULL,
    target_record_id bigint not null,
    account_id varchar(36) NOT NULL,
    payment_method_id varchar(36) DEFAULT NULL,
    payment_external_key varchar(255) NOT NULL,
    transaction_id varchar(36),
    transaction_external_key varchar(255) NOT NULL,
    transaction_type varchar(32) NOT NULL,
    state_name varchar(32) NOT NULL,
    amount numeric(15,9),
    currency varchar(3),
    plugin_name varchar(1024) NOT NULL,
    plugin_properties mediumblob,
    change_type varchar(6) NOT NULL,
    created_by varchar(50) NOT NULL,
    created_date datetime NOT NULL,
    updated_by varchar(50) NOT NULL,
    updated_date datetime NOT NULL,
    account_record_id bigint not null,
    tenant_record_id bigint not null default 0,
    PRIMARY KEY(record_id)
);
CREATE INDEX payment_attempt_history_target_record_id ON payment_attempt_history(target_record_id);
CREATE INDEX payment_attempt_history_tenant_account_record_id ON payment_attempt_history(tenant_record_id, account_record_id);

DROP TABLE IF EXISTS payment_methods;
CREATE TABLE payment_methods (
    record_id serial unique,
    id varchar(36) NOT NULL,
    external_key varchar(255) NOT NULL,
    account_id varchar(36) NOT NULL,
    plugin_name varchar(50) NOT NULL,
    is_active boolean default true,
    created_by varchar(50) NOT NULL,
    created_date datetime NOT NULL,
    updated_by varchar(50) NOT NULL,
    updated_date datetime NOT NULL,
    account_record_id bigint not null,
    tenant_record_id bigint not null default 0,
    PRIMARY KEY (record_id)
);
CREATE UNIQUE INDEX payment_methods_id ON payment_methods(id);
CREATE UNIQUE INDEX payment_methods_external_key ON payment_methods(external_key, tenant_record_id);
CREATE INDEX payment_methods_plugin_name ON payment_methods(plugin_name);
CREATE INDEX payment_methods_tenant_account_record_id ON payment_methods(tenant_record_id, account_record_id);

DROP TABLE IF EXISTS payment_method_history;
CREATE TABLE payment_method_history (
    record_id serial unique,
    id varchar(36) NOT NULL,
    external_key varchar(255) NOT NULL,
    target_record_id bigint not null,
    account_id varchar(36) NOT NULL,
    plugin_name varchar(50) NOT NULL,
    is_active boolean default true,
    change_type varchar(6) NOT NULL,
    created_by varchar(50) NOT NULL,
    created_date datetime NOT NULL,
    updated_by varchar(50) NOT NULL,
    updated_date datetime NOT NULL,
    account_record_id bigint not null,
    tenant_record_id bigint not null default 0,
    PRIMARY KEY(record_id)
);
CREATE INDEX payment_method_history_target_record_id ON payment_method_history(target_record_id);
CREATE INDEX payment_method_history_tenant_account_record_id ON payment_method_history(tenant_record_id, account_record_id);


DROP TABLE IF EXISTS payments;
CREATE TABLE payments (
    record_id serial unique,
    id varchar(36) NOT NULL,
    account_id varchar(36) NOT NULL,
    payment_method_id varchar(36) NOT NULL,
    external_key varchar(255) NOT NULL,
    state_name varchar(64) DEFAULT NULL,
    last_success_state_name varchar(64) DEFAULT NULL,
    created_by varchar(50) NOT NULL,
    created_date datetime NOT NULL,
    updated_by varchar(50) NOT NULL,
    updated_date datetime NOT NULL,
    account_record_id bigint not null,
    tenant_record_id bigint not null default 0,
    PRIMARY KEY (record_id)
);
CREATE UNIQUE INDEX payments_id ON payments(id);
CREATE UNIQUE INDEX payments_key ON payments(external_key, tenant_record_id);
CREATE INDEX payments_accnt ON payments(account_id);
CREATE INDEX payments_tenant_account_record_id ON payments(tenant_record_id, account_record_id);
CREATE INDEX payments_tenant_record_id_state_name ON payments(tenant_record_id, state_name);


DROP TABLE IF EXISTS payment_history;
CREATE TABLE payment_history (
    record_id serial unique,
    id varchar(36) NOT NULL,
    target_record_id bigint not null,
    account_id varchar(36) NOT NULL,
    payment_method_id varchar(36) NOT NULL,
    external_key varchar(255) NOT NULL,
    state_name varchar(64) DEFAULT NULL,
    last_success_state_name varchar(64) DEFAULT NULL,
    change_type varchar(6) NOT NULL,
    created_by varchar(50) NOT NULL,
    created_date datetime NOT NULL,
    updated_by varchar(50) NOT NULL,
    updated_date datetime NOT NULL,
    account_record_id bigint not null,
    tenant_record_id bigint not null default 0,
    PRIMARY KEY(record_id)
);
CREATE INDEX payment_history_target_record_id ON payment_history(target_record_id);
CREATE INDEX payment_history_tenant_account_record_id ON payment_history(tenant_record_id, account_record_id);


DROP TABLE IF EXISTS payment_transactions;
CREATE TABLE payment_transactions (
    record_id serial unique,
    id varchar(36) NOT NULL,
    attempt_id varchar(36) DEFAULT NULL,
    transaction_external_key varchar(255) NOT NULL,
    transaction_type varchar(32) NOT NULL,
    effective_date datetime NOT NULL,
    transaction_status varchar(50) NOT NULL,
    amount numeric(15,9),
    currency varchar(3),
    processed_amount numeric(15,9),
    processed_currency varchar(3),
    payment_id varchar(36) NOT NULL,
    gateway_error_code varchar(32),
    gateway_error_msg text,
    created_by varchar(50) NOT NULL,
    created_date datetime NOT NULL,
    updated_by varchar(50) NOT NULL,
    updated_date datetime NOT NULL,
    account_record_id bigint not null,
    tenant_record_id bigint not null default 0,
    PRIMARY KEY (record_id)
);
CREATE UNIQUE INDEX transactions_id ON payment_transactions(id);
CREATE INDEX transactions_payment_id ON payment_transactions(payment_id);
CREATE INDEX transactions_key ON payment_transactions(transaction_external_key);
CREATE INDEX transactions_status ON payment_transactions(transaction_status);
CREATE INDEX transactions_tenant_account_record_id ON payment_transactions(tenant_record_id, account_record_id);

DROP TABLE IF EXISTS payment_transaction_history;
CREATE TABLE payment_transaction_history (
    record_id serial unique,
    id varchar(36) NOT NULL,
    attempt_id varchar(36) DEFAULT NULL,
    transaction_external_key varchar(255) NOT NULL,
    target_record_id bigint not null,
    transaction_type varchar(32) NOT NULL,
    effective_date datetime NOT NULL,
    transaction_status varchar(50) NOT NULL,
    amount numeric(15,9),
    currency varchar(3),
    processed_amount numeric(15,9),
    processed_currency varchar(3),
    payment_id varchar(36) NOT NULL,
    gateway_error_code varchar(32),
    gateway_error_msg text,
    change_type varchar(6) NOT NULL,
    created_by varchar(50) NOT NULL,
    created_date datetime NOT NULL,
    updated_by varchar(50) NOT NULL,
    updated_date datetime NOT NULL,
    account_record_id bigint not null,
    tenant_record_id bigint not null default 0,
    PRIMARY KEY (record_id)
);
CREATE INDEX transaction_history_target_record_id ON payment_transaction_history(target_record_id);
CREATE INDEX transaction_history_tenant_account_record_id ON payment_transaction_history(tenant_record_id, account_record_id);


/*  PaymentControlPlugin lives  here until this becomes a first class citizen plugin */
DROP TABLE IF EXISTS invoice_payment_control_plugin_auto_pay_off;
CREATE TABLE invoice_payment_control_plugin_auto_pay_off (
    record_id serial unique,
    attempt_id varchar(36) NOT NULL,
    payment_external_key varchar(255) NOT NULL,
    transaction_external_key varchar(255) NOT NULL,
    account_id varchar(36) NOT NULL,
    plugin_name varchar(50) NOT NULL,
    payment_id varchar(36),
    amount numeric(15,9),
    currency varchar(3),
    is_active boolean default true,
    created_by varchar(50) NOT NULL,
    created_date datetime NOT NULL,
    PRIMARY KEY (record_id)
);
CREATE INDEX invoice_payment_control_plugin_auto_pay_off_account ON invoice_payment_control_plugin_auto_pay_off(account_id);



DROP TABLE IF EXISTS rolled_up_usage;
CREATE TABLE rolled_up_usage (
    record_id serial unique,
    id varchar(36) NOT NULL,
    subscription_id varchar(36) NOT NULL,
    unit_type varchar(255) NOT NULL,
    record_date date NOT NULL,
    amount bigint NOT NULL,
    tracking_id varchar(128) NOT NULL,
    created_by varchar(50) NOT NULL,
    created_date datetime NOT NULL,
    account_record_id bigint not null,
    tenant_record_id bigint not null default 0,
    PRIMARY KEY(record_id)
);
CREATE UNIQUE INDEX rolled_up_usage_id ON rolled_up_usage(id);
CREATE INDEX rolled_up_usage_subscription_id ON rolled_up_usage(subscription_id ASC);
CREATE INDEX rolled_up_usage_tenant_account_record_id ON rolled_up_usage(tenant_record_id, account_record_id);
CREATE INDEX rolled_up_usage_account_record_id ON rolled_up_usage(account_record_id);
CREATE INDEX rolled_up_usage_tracking_id_subscription_id_tenant_record_id ON rolled_up_usage(tracking_id, subscription_id, tenant_record_id);



DROP TABLE IF EXISTS custom_fields;
CREATE TABLE custom_fields (
    record_id serial unique,
    id varchar(36) NOT NULL,
    object_id varchar(36) NOT NULL,
    object_type varchar(30) NOT NULL,
    is_active boolean default true,
    field_name varchar(64) NOT NULL,
    field_value varchar(255),
    created_by varchar(50) NOT NULL,
    created_date datetime NOT NULL,
    updated_by varchar(50) DEFAULT NULL,
    updated_date datetime DEFAULT NULL,
    account_record_id bigint not null,
    tenant_record_id bigint not null default 0,
    PRIMARY KEY(record_id)
);
CREATE UNIQUE INDEX custom_fields_id ON custom_fields(id);
CREATE INDEX custom_fields_object_id_object_type ON custom_fields(object_id, object_type);
CREATE INDEX custom_fields_tenant_account_record_id ON custom_fields(tenant_record_id, account_record_id);
CREATE INDEX custom_fields_name_value ON custom_fields(field_name, field_value);


DROP TABLE IF EXISTS custom_field_history;
CREATE TABLE custom_field_history (
    record_id serial unique,
    id varchar(36) NOT NULL,
    target_record_id bigint not null,
    object_id varchar(36) NOT NULL,
    object_type varchar(30) NOT NULL,
    is_active boolean default true,
    field_name varchar(64),
    field_value varchar(255),
    change_type varchar(6) NOT NULL,
    created_by varchar(50) NOT NULL,
    created_date datetime NOT NULL,
    updated_by varchar(50) NOT NULL,
    updated_date datetime NOT NULL,
    account_record_id bigint not null,
    tenant_record_id bigint not null default 0,
    PRIMARY KEY(record_id)
);
CREATE INDEX custom_field_history_target_record_id ON custom_field_history(target_record_id);
CREATE INDEX custom_field_history_object_id_object_type ON custom_field_history(object_id, object_type);
CREATE INDEX custom_field_history_tenant_account_record_id ON custom_field_history(tenant_record_id, account_record_id);

DROP TABLE IF EXISTS tag_definitions;
CREATE TABLE tag_definitions (
    record_id serial unique,
    id varchar(36) NOT NULL,
    name varchar(20) NOT NULL,
    applicable_object_types varchar(500),
    description varchar(200) NOT NULL,
    is_active boolean default true,
    created_by varchar(50) NOT NULL,
    created_date datetime NOT NULL,
    updated_by varchar(50) NOT NULL,
    updated_date datetime NOT NULL,
    tenant_record_id bigint not null default 0,
    PRIMARY KEY(record_id)
);
CREATE UNIQUE INDEX tag_definitions_id ON tag_definitions(id);
CREATE INDEX tag_definitions_tenant_record_id ON tag_definitions(tenant_record_id);

DROP TABLE IF EXISTS tag_definition_history;
CREATE TABLE tag_definition_history (
    record_id serial unique,
    id varchar(36) NOT NULL,
    target_record_id bigint not null,
    name varchar(30) NOT NULL,
    applicable_object_types varchar(500),
    description varchar(200),
    is_active boolean default true,
    change_type varchar(6) NOT NULL,
    created_by varchar(50) NOT NULL,
    created_date datetime NOT NULL,
    updated_by varchar(50) NOT NULL,
    updated_date datetime NOT NULL,
    /* Note: there is no account_record_id to populate */
    account_record_id bigint default null,
    tenant_record_id bigint not null default 0,
    PRIMARY KEY(record_id)
);
CREATE INDEX tag_definition_history_id ON tag_definition_history(id);
CREATE INDEX tag_definition_history_target_record_id ON tag_definition_history(target_record_id);
CREATE INDEX tag_definition_history_name ON tag_definition_history(name);
CREATE INDEX tag_definition_history_tenant_record_id ON tag_definition_history(tenant_record_id);

DROP TABLE IF EXISTS tags;
CREATE TABLE tags (
    record_id serial unique,
    id varchar(36) NOT NULL,
    tag_definition_id varchar(36) NOT NULL,
    object_id varchar(36) NOT NULL,
    object_type varchar(30) NOT NULL,
    is_active boolean default true,
    created_by varchar(50) NOT NULL,
    created_date datetime NOT NULL,
    updated_by varchar(50) NOT NULL,
    updated_date datetime NOT NULL,
    account_record_id bigint not null,
    tenant_record_id bigint not null default 0,
    PRIMARY KEY(record_id)
);
CREATE UNIQUE INDEX tags_id ON tags(id);
CREATE INDEX tags_by_object ON tags(object_id);
CREATE INDEX tags_tenant_account_record_id ON tags(tenant_record_id, account_record_id);

DROP TABLE IF EXISTS tag_history;
CREATE TABLE tag_history (
    record_id serial unique,
    id varchar(36) NOT NULL,
    target_record_id bigint not null,
    object_id varchar(36) NOT NULL,
    object_type varchar(30) NOT NULL,
    tag_definition_id varchar(36) NOT NULL,
    is_active boolean default true,
    change_type varchar(6) NOT NULL,
    created_by varchar(50) NOT NULL,
    created_date datetime NOT NULL,
    updated_by varchar(50) NOT NULL,
    updated_date datetime NOT NULL,
    account_record_id bigint not null,
    tenant_record_id bigint not null default 0,
    PRIMARY KEY(record_id)
);
CREATE INDEX tag_history_target_record_id ON tag_history(target_record_id);
CREATE INDEX tag_history_by_object ON tag_history(object_id);
CREATE INDEX tag_history_tenant_account_record_id ON tag_history(tenant_record_id, account_record_id);

DROP TABLE IF EXISTS audit_log;
CREATE TABLE audit_log (
    record_id serial unique,
    id varchar(36) NOT NULL,
    target_record_id bigint not null,
    table_name varchar(50) NOT NULL,
    change_type varchar(6) NOT NULL,
    created_date datetime NOT NULL,
    created_by varchar(50) NOT NULL,
    reason_code varchar(255) DEFAULT NULL,
    comments varchar(255) DEFAULT NULL,
    user_token varchar(36),
    /* Note: can be NULL (e.g. tenant_kvs audits) */
    account_record_id bigint default null,
    tenant_record_id bigint not null default 0,
    PRIMARY KEY(record_id)
);
CREATE INDEX audit_log_fetch_target_record_id ON audit_log(table_name, target_record_id);
CREATE INDEX audit_log_user_name ON audit_log(created_by);
CREATE INDEX audit_log_tenant_account_record_id ON audit_log(tenant_record_id, account_record_id);
CREATE INDEX audit_log_via_history ON audit_log(target_record_id, table_name, tenant_record_id);



DROP TABLE IF EXISTS notifications;
CREATE TABLE notifications (
    record_id serial unique,
    class_name varchar(256) NOT NULL,
    event_json text NOT NULL,
    user_token varchar(36),
    created_date datetime NOT NULL,
    creating_owner varchar(50) NOT NULL,
    processing_owner varchar(50) DEFAULT NULL,
    processing_available_date datetime DEFAULT NULL,
    processing_state varchar(14) DEFAULT 'AVAILABLE',
    error_count int DEFAULT 0,
    search_key1 bigint not null,
    search_key2 bigint not null default 0,
    queue_name varchar(64) NOT NULL,
    effective_date datetime NOT NULL,
    future_user_token varchar(36),
    PRIMARY KEY(record_id)
);
CREATE INDEX idx_comp_where ON notifications (effective_date, processing_state, processing_owner, processing_available_date);
CREATE INDEX idx_update ON notifications (processing_state, processing_owner, processing_available_date);
CREATE INDEX idx_get_ready ON notifications (effective_date, created_date);
CREATE INDEX notifications_tenant_account_record_id ON notifications(search_key2, search_key1);

DROP TABLE IF EXISTS notifications_history;
CREATE TABLE notifications_history (
    record_id serial unique,
    class_name varchar(256) NOT NULL,
    event_json text NOT NULL,
    user_token varchar(36),
    created_date datetime NOT NULL,
    creating_owner varchar(50) NOT NULL,
    processing_owner varchar(50) DEFAULT NULL,
    processing_available_date datetime DEFAULT NULL,
    processing_state varchar(14) DEFAULT 'AVAILABLE',
    error_count int DEFAULT 0,
    search_key1 bigint not null,
    search_key2 bigint not null default 0,
    queue_name varchar(64) NOT NULL,
    effective_date datetime NOT NULL,
    future_user_token varchar(36),
    PRIMARY KEY(record_id)
);
CREATE INDEX notifications_history_tenant_account_record_id ON notifications_history(search_key2, search_key1);

DROP TABLE IF EXISTS bus_events;
CREATE TABLE bus_events (
    record_id serial unique,
    class_name varchar(128) NOT NULL,
    event_json text NOT NULL,
    user_token varchar(36),
    created_date datetime NOT NULL,
    creating_owner varchar(50) NOT NULL,
    processing_owner varchar(50) DEFAULT NULL,
    processing_available_date datetime DEFAULT NULL,
    processing_state varchar(14) DEFAULT 'AVAILABLE',
    error_count int DEFAULT 0,
    /* Note: account_record_id can be NULL (e.g. TagDefinition events) */
    search_key1 bigint default null,
    search_key2 bigint not null default 0,
    PRIMARY KEY(record_id)
);
CREATE INDEX idx_bus_where ON bus_events (processing_state, processing_owner, processing_available_date);
CREATE INDEX bus_events_tenant_account_record_id ON bus_events(search_key2, search_key1);

DROP TABLE IF EXISTS bus_events_history;
CREATE TABLE bus_events_history (
    record_id serial unique,
    class_name varchar(128) NOT NULL,
    event_json text NOT NULL,
    user_token varchar(36),
    created_date datetime NOT NULL,
    creating_owner varchar(50) NOT NULL,
    processing_owner varchar(50) DEFAULT NULL,
    processing_available_date datetime DEFAULT NULL,
    processing_state varchar(14) DEFAULT 'AVAILABLE',
    error_count int DEFAULT 0,
    /* Note: account_record_id can be NULL (e.g. TagDefinition events) */
    search_key1 bigint default null,
    search_key2 bigint not null default 0,
    PRIMARY KEY(record_id)
);
CREATE INDEX bus_events_history_tenant_account_record_id ON bus_events_history(search_key2, search_key1);

drop table if exists sessions;
create table sessions (
  record_id serial unique
, id varchar(36) NOT NULL
, start_timestamp datetime not null
, last_access_time datetime default null
, timeout int
, host varchar(100) default null
, session_data mediumblob default null
, primary key(record_id)
);
CREATE UNIQUE INDEX sessions_id ON sessions(id);


DROP TABLE IF EXISTS users;
CREATE TABLE users (
    record_id serial unique,
    username varchar(128) NULL,
    password varchar(128) NULL,
    password_salt varchar(128) NULL,
    is_active boolean default true,
    created_date datetime NOT NULL,
    created_by varchar(50) NOT NULL,
    updated_date datetime DEFAULT NULL,
    updated_by varchar(50) DEFAULT NULL,
    PRIMARY KEY(record_id)
);
CREATE INDEX users_username ON users(username);


DROP TABLE IF EXISTS user_roles;
CREATE TABLE user_roles (
    record_id serial unique,
    username varchar(128) NULL,
    role_name varchar(128) NULL,
    is_active boolean default true,
    created_date datetime NOT NULL,
    created_by varchar(50) NOT NULL,
    updated_date datetime DEFAULT NULL,
    updated_by varchar(50) DEFAULT NULL,
    PRIMARY KEY(record_id)
);
CREATE INDEX user_roles_idx ON user_roles(username, role_name);


DROP TABLE IF EXISTS roles_permissions;
CREATE TABLE roles_permissions (
    record_id serial unique,
    role_name varchar(128) NULL,
    permission varchar(128) NULL,
    is_active boolean default true,
    created_date datetime NOT NULL,
    created_by varchar(50) NOT NULL,
    updated_date datetime DEFAULT NULL,
    updated_by varchar(50) DEFAULT NULL,
    PRIMARY KEY(record_id)
);
CREATE INDEX roles_permissions_idx ON roles_permissions(role_name, permission);


DROP TABLE IF EXISTS node_infos;
CREATE TABLE node_infos (
    record_id serial unique,
    node_name varchar(50) NOT NULL,
    boot_date datetime NOT NULL,
    updated_date datetime DEFAULT NULL,
    node_info text NOT NULL,
    is_active boolean default true,
    PRIMARY KEY(record_id)
);
CREATE UNIQUE INDEX node_name_idx ON node_infos(node_name);


DROP TABLE IF EXISTS service_broadcasts;
CREATE TABLE service_broadcasts (
    record_id serial unique,
    service_name varchar(50) NOT NULL,
    type varchar(64) NOT NULL,
    event text NOT NULL,
    created_date datetime NOT NULL,
    created_by varchar(50) NOT NULL,
    PRIMARY KEY(record_id)
);



DROP TABLE IF EXISTS tenants;
CREATE TABLE tenants (
    record_id serial unique,
    id varchar(36) NOT NULL,
    external_key varchar(255) NULL,
    api_key varchar(128) NULL,
    api_secret varchar(128) NULL,
    api_salt varchar(128) NULL,
    created_date datetime NOT NULL,
    created_by varchar(50) NOT NULL,
    updated_date datetime DEFAULT NULL,
    updated_by varchar(50) DEFAULT NULL,
    PRIMARY KEY(record_id)
);
CREATE UNIQUE INDEX tenants_id ON tenants(id);
CREATE UNIQUE INDEX tenants_api_key ON tenants(api_key);


DROP TABLE IF EXISTS tenant_kvs;
CREATE TABLE tenant_kvs (
   record_id serial unique,
   id varchar(36) NOT NULL,
   tenant_record_id bigint not null default 0,
   tenant_key varchar(255) NOT NULL,
   tenant_value mediumtext NOT NULL,
   is_active boolean default true,
   created_date datetime NOT NULL,
   created_by varchar(50) NOT NULL,
   updated_date datetime DEFAULT NULL,
   updated_by varchar(50) DEFAULT NULL,
   PRIMARY KEY(record_id)
);
CREATE INDEX tenant_kvs_trid_key ON tenant_kvs(tenant_record_id, tenant_key);


DROP TABLE IF EXISTS tenant_broadcasts;
CREATE TABLE tenant_broadcasts (
   record_id serial unique,
   id varchar(36) NOT NULL,
   /* Note: can be NULL in case of delete */
   target_record_id bigint default null,
   target_table_name varchar(50) NOT NULL,
   tenant_record_id bigint not null default 0,
   type varchar(64) NOT NULL,
   user_token varchar(36),
   created_date datetime NOT NULL,
   created_by varchar(50) NOT NULL,
   updated_date datetime DEFAULT NULL,
   updated_by varchar(50) DEFAULT NULL,
   PRIMARY KEY(record_id)
);
CREATE INDEX tenant_broadcasts_key ON tenant_broadcasts(tenant_record_id);

