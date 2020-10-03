CREATE DATABASE killbill;
CREATE USER 'killbill'@'%' IDENTIFIED BY 'REDACTED';
GRANT SELECT, UPDATE, DELETE, INSERT ON killbill.* TO 'killbill'@'%';

-- KILLBILL DDL
-- https://docs.killbill.io/0.22/ddl.sql

use killbill;

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
    tenant_record_id bigint /*! unsigned */ not null default 0,
    PRIMARY KEY(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
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
    target_record_id bigint /*! unsigned */ not null,
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
    tenant_record_id bigint /*! unsigned */ not null default 0,
    PRIMARY KEY(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
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
    account_record_id bigint /*! unsigned */ not null,
    tenant_record_id bigint /*! unsigned */ not null default 0,
    PRIMARY KEY(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
CREATE UNIQUE INDEX account_email_id ON account_emails(id);
CREATE INDEX account_email_account_id_email ON account_emails(account_id, email);
CREATE INDEX account_emails_tenant_account_record_id ON account_emails(tenant_record_id, account_record_id);

DROP TABLE IF EXISTS account_email_history;
CREATE TABLE account_email_history (
    record_id serial unique,
    id varchar(36) NOT NULL,
    target_record_id bigint /*! unsigned */ not null,
    account_id varchar(36) NOT NULL,
    email varchar(128) NOT NULL,
    is_active boolean default true,
    change_type varchar(6) NOT NULL,
    created_by varchar(50) NOT NULL,
    created_date datetime NOT NULL,
    updated_by varchar(50) NOT NULL,
    updated_date datetime NOT NULL,
    account_record_id bigint /*! unsigned */ not null,
    tenant_record_id bigint /*! unsigned */ not null default 0,
    PRIMARY KEY(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
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
    error_count int /*! unsigned */ DEFAULT 0,
    /* Note: account_record_id can be NULL (e.g. TagDefinition events) */
    search_key1 bigint /*! unsigned */ default null,
    search_key2 bigint /*! unsigned */ not null default 0,
    PRIMARY KEY(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
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
    error_count int /*! unsigned */ DEFAULT 0,
    /* Note: account_record_id can be NULL (e.g. TagDefinition events) */
    search_key1 bigint /*! unsigned */ default null,
    search_key2 bigint /*! unsigned */ not null default 0,
    PRIMARY KEY(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
CREATE INDEX bus_ext_events_history_tenant_account_record_id ON bus_ext_events_history(search_key2, search_key1);



DROP TABLE IF EXISTS catalog_override_plan_definition;
CREATE TABLE catalog_override_plan_definition (
    record_id serial unique,
    parent_plan_name varchar(255) NOT NULL,
    effective_date datetime NOT NULL,
    is_active boolean default true,
    created_date datetime NOT NULL,
    created_by varchar(50) NOT NULL,
    tenant_record_id bigint /*! unsigned */ not null default 0,
    PRIMARY KEY(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
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
    tenant_record_id bigint /*! unsigned */ not null default 0,
    PRIMARY KEY(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
CREATE INDEX catalog_override_phase_definition_idx ON catalog_override_phase_definition(tenant_record_id, parent_phase_name, currency);

DROP TABLE IF EXISTS catalog_override_plan_phase;
CREATE TABLE catalog_override_plan_phase (
    record_id serial unique,
    phase_number int /*! unsigned */ NOT NULL,
    phase_def_record_id bigint /*! unsigned */ not null,
    target_plan_def_record_id bigint /*! unsigned */ not null,
    created_date datetime NOT NULL,
    created_by varchar(50) NOT NULL,
    tenant_record_id bigint /*! unsigned */ not null default 0,
    PRIMARY KEY(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
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
tenant_record_id bigint /*! unsigned */ not null default 0,
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
tenant_record_id bigint /*! unsigned */ not null default 0,
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
tenant_record_id bigint /*! unsigned */ not null default 0,
PRIMARY KEY(record_id)
);
CREATE INDEX catalog_override_block_definition_idx ON catalog_override_block_definition(tenant_record_id, parent_unit_name, currency);


DROP TABLE IF EXISTS catalog_override_phase_usage;
create table catalog_override_phase_usage
(
record_id serial unique,
usage_number int /*! unsigned */,
usage_def_record_id  bigint /*! unsigned */ not null,
target_phase_def_record_id bigint /*! unsigned */ not null,
created_date datetime NOT NULL,
created_by varchar(50) NOT NULL,
tenant_record_id bigint /*! unsigned */ not null default 0,
PRIMARY KEY(record_id)
);
CREATE INDEX catalog_override_phase_usage_idx ON catalog_override_phase_usage(tenant_record_id, usage_number, usage_def_record_id);

DROP TABLE IF EXISTS catalog_override_usage_tier;
create table catalog_override_usage_tier
(
record_id serial unique,
tier_number int /*! unsigned */,
tier_def_record_id bigint /*! unsigned */ not null,
target_usage_def_record_id bigint /*! unsigned */ not null,
created_date datetime NOT NULL,
created_by varchar(50) NOT NULL,
tenant_record_id bigint /*! unsigned */ not null default 0,
PRIMARY KEY(record_id)
);
CREATE INDEX catalog_override_usage_tier_idx ON catalog_override_usage_tier(tenant_record_id, tier_number, tier_def_record_id);


DROP TABLE IF EXISTS catalog_override_tier_block;
create table catalog_override_tier_block
(
record_id serial unique,
block_number int /*! unsigned */,
block_def_record_id bigint /*! unsigned */ not null,
target_tier_def_record_id bigint /*! unsigned */ not null,
created_date datetime NOT NULL,
created_by varchar(50) NOT NULL,
tenant_record_id bigint /*! unsigned */ NOT NULL default 0,
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
    account_record_id bigint /*! unsigned */ not null,
    tenant_record_id bigint /*! unsigned */ not null default 0,
    PRIMARY KEY(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
CREATE UNIQUE INDEX subscription_events_id ON subscription_events(id);
CREATE INDEX idx_ent_1 ON subscription_events(subscription_id, is_active, effective_date);
CREATE INDEX idx_ent_2 ON subscription_events(subscription_id, effective_date, created_date, id);
CREATE INDEX subscription_events_tenant_account_record_id ON subscription_events(tenant_record_id, account_record_id);


DROP TABLE IF EXISTS subscription_event_history;
CREATE TABLE subscription_event_history (
    record_id serial unique,
    id varchar(36) NOT NULL,
    target_record_id bigint /*! unsigned */ not null,
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
    account_record_id bigint /*! unsigned */ not null,
    tenant_record_id bigint /*! unsigned */ not null default 0,
    PRIMARY KEY(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
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
    account_record_id bigint /*! unsigned */ not null,
    tenant_record_id bigint /*! unsigned */ not null default 0,
    PRIMARY KEY(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
CREATE UNIQUE INDEX subscriptions_id ON subscriptions(id);
CREATE UNIQUE INDEX subscriptions_external_key ON subscriptions(external_key, tenant_record_id);
CREATE INDEX subscriptions_bundle_id ON subscriptions(bundle_id);
CREATE INDEX subscriptions_tenant_account_record_id ON subscriptions(tenant_record_id, account_record_id);

DROP TABLE IF EXISTS subscription_history;
CREATE TABLE subscription_history (
    record_id serial unique,
    id varchar(36) NOT NULL,
    target_record_id bigint /*! unsigned */ not null,
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
    account_record_id bigint /*! unsigned */ not null,
    tenant_record_id bigint /*! unsigned */ not null default 0,
    PRIMARY KEY(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
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
    account_record_id bigint /*! unsigned */ not null,
    tenant_record_id bigint /*! unsigned */ not null default 0,
    PRIMARY KEY(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
CREATE UNIQUE INDEX bundles_id ON bundles(id);
CREATE UNIQUE INDEX bundles_external_key ON bundles(external_key, tenant_record_id);
CREATE INDEX bundles_account ON bundles(account_id);
CREATE INDEX bundles_tenant_account_record_id ON bundles(tenant_record_id, account_record_id);

DROP TABLE IF EXISTS bundle_history;
CREATE TABLE bundle_history (
    record_id serial unique,
    id varchar(36) NOT NULL,
    target_record_id bigint /*! unsigned */ not null,
    external_key varchar(255) NOT NULL,
    account_id varchar(36) NOT NULL,
    last_sys_update_date datetime,
    original_created_date datetime NOT NULL,
    change_type varchar(6) NOT NULL,
    created_by varchar(50) NOT NULL,
    created_date datetime NOT NULL,
    updated_by varchar(50) NOT NULL,
    updated_date datetime NOT NULL,
    account_record_id bigint /*! unsigned */ not null,
    tenant_record_id bigint /*! unsigned */ not null default 0,
    PRIMARY KEY(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
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
    account_record_id bigint /*! unsigned */ not null,
    tenant_record_id bigint /*! unsigned */ not null default 0,
    PRIMARY KEY(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
CREATE INDEX blocking_states_id ON blocking_states(blockable_id);
CREATE INDEX blocking_states_id_real ON blocking_states(id);
CREATE INDEX blocking_states_tenant_account_record_id ON blocking_states(tenant_record_id, account_record_id);

DROP TABLE IF EXISTS blocking_state_history;
CREATE TABLE blocking_state_history (
    record_id serial unique,
    id varchar(36) NOT NULL,
    target_record_id bigint /*! unsigned */ not null,
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
    account_record_id bigint /*! unsigned */ not null,
    tenant_record_id bigint /*! unsigned */ not null default 0,
    PRIMARY KEY(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
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
    account_record_id bigint /*! unsigned */ not null,
    tenant_record_id bigint /*! unsigned */ not null default 0,
    PRIMARY KEY(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
CREATE INDEX invoice_tracking_tenant_account_date_idx ON invoice_tracking_ids(tenant_record_id, account_record_id, record_date);
CREATE INDEX invoice_tracking_invoice_id_idx ON invoice_tracking_ids(invoice_id);
CREATE INDEX invoice_tracking_id_idx ON invoice_tracking_ids(id);


DROP TABLE IF EXISTS invoice_tracking_id_history;
CREATE TABLE invoice_tracking_id_history (
    record_id serial unique,
    id varchar(36) NOT NULL,
    target_record_id bigint /*! unsigned */ not null,
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
    account_record_id bigint /*! unsigned */ not null,
    tenant_record_id bigint /*! unsigned */ not null default 0,
    PRIMARY KEY(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
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
    account_record_id bigint /*! unsigned */ not null,
    tenant_record_id bigint /*! unsigned */ not null default 0,
    PRIMARY KEY(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
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
    target_record_id bigint /*! unsigned */ not null,
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
    account_record_id bigint /*! unsigned */ not null,
    tenant_record_id bigint /*! unsigned */ not null default 0,
    PRIMARY KEY(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
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
    account_record_id bigint /*! unsigned */ not null,
    tenant_record_id bigint /*! unsigned */ not null default 0,
    PRIMARY KEY(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
CREATE UNIQUE INDEX invoices_id ON invoices(id);
CREATE INDEX invoices_account ON invoices(account_id ASC);
CREATE INDEX invoices_tenant_account_record_id ON invoices(tenant_record_id, account_record_id);


DROP TABLE IF EXISTS invoice_history;
CREATE TABLE invoice_history (
    record_id serial unique,
    id varchar(36) NOT NULL,
    target_record_id bigint /*! unsigned */ not null,
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
    account_record_id bigint /*! unsigned */ not null,
    tenant_record_id bigint /*! unsigned */ not null default 0,
    PRIMARY KEY(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
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
    account_record_id bigint /*! unsigned */ not null,
    tenant_record_id bigint /*! unsigned */ not null default 0,
    PRIMARY KEY(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
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
    target_record_id bigint /*! unsigned */ not null,
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
    account_record_id bigint /*! unsigned */ not null,
    tenant_record_id bigint /*! unsigned */ not null default 0,
    PRIMARY KEY(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
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
    account_record_id bigint /*! unsigned */ not null,
    tenant_record_id bigint /*! unsigned */ not null default 0,
    PRIMARY KEY(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
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
    account_record_id bigint /*! unsigned */ not null,
    tenant_record_id bigint /*! unsigned */ not null default 0,
    PRIMARY KEY(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
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
    account_record_id bigint /*! unsigned */ not null,
    tenant_record_id bigint /*! unsigned */ not null default 0,
    PRIMARY KEY (record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
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
    target_record_id bigint /*! unsigned */ not null,
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
    account_record_id bigint /*! unsigned */ not null,
    tenant_record_id bigint /*! unsigned */ not null default 0,
    PRIMARY KEY(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
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
    account_record_id bigint /*! unsigned */ not null,
    tenant_record_id bigint /*! unsigned */ not null default 0,
    PRIMARY KEY (record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
CREATE UNIQUE INDEX payment_methods_id ON payment_methods(id);
CREATE UNIQUE INDEX payment_methods_external_key ON payment_methods(external_key, tenant_record_id);
CREATE INDEX payment_methods_plugin_name ON payment_methods(plugin_name);
CREATE INDEX payment_methods_tenant_account_record_id ON payment_methods(tenant_record_id, account_record_id);

DROP TABLE IF EXISTS payment_method_history;
CREATE TABLE payment_method_history (
    record_id serial unique,
    id varchar(36) NOT NULL,
    external_key varchar(255) NOT NULL,
    target_record_id bigint /*! unsigned */ not null,
    account_id varchar(36) NOT NULL,
    plugin_name varchar(50) NOT NULL,
    is_active boolean default true,
    change_type varchar(6) NOT NULL,
    created_by varchar(50) NOT NULL,
    created_date datetime NOT NULL,
    updated_by varchar(50) NOT NULL,
    updated_date datetime NOT NULL,
    account_record_id bigint /*! unsigned */ not null,
    tenant_record_id bigint /*! unsigned */ not null default 0,
    PRIMARY KEY(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
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
    account_record_id bigint /*! unsigned */ not null,
    tenant_record_id bigint /*! unsigned */ not null default 0,
    PRIMARY KEY (record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
CREATE UNIQUE INDEX payments_id ON payments(id);
CREATE UNIQUE INDEX payments_key ON payments(external_key, tenant_record_id);
CREATE INDEX payments_accnt ON payments(account_id);
CREATE INDEX payments_tenant_account_record_id ON payments(tenant_record_id, account_record_id);
CREATE INDEX payments_tenant_record_id_state_name ON payments(tenant_record_id, state_name);


DROP TABLE IF EXISTS payment_history;
CREATE TABLE payment_history (
    record_id serial unique,
    id varchar(36) NOT NULL,
    target_record_id bigint /*! unsigned */ not null,
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
    account_record_id bigint /*! unsigned */ not null,
    tenant_record_id bigint /*! unsigned */ not null default 0,
    PRIMARY KEY(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
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
    account_record_id bigint /*! unsigned */ not null,
    tenant_record_id bigint /*! unsigned */ not null default 0,
    PRIMARY KEY (record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
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
    target_record_id bigint /*! unsigned */ not null,
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
    account_record_id bigint /*! unsigned */ not null,
    tenant_record_id bigint /*! unsigned */ not null default 0,
    PRIMARY KEY (record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
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
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
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
    account_record_id bigint /*! unsigned */ not null,
    tenant_record_id bigint /*! unsigned */ not null default 0,
    PRIMARY KEY(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
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
    account_record_id bigint /*! unsigned */ not null,
    tenant_record_id bigint /*! unsigned */ not null default 0,
    PRIMARY KEY(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
CREATE UNIQUE INDEX custom_fields_id ON custom_fields(id);
CREATE INDEX custom_fields_object_id_object_type ON custom_fields(object_id, object_type);
CREATE INDEX custom_fields_tenant_account_record_id ON custom_fields(tenant_record_id, account_record_id);
CREATE INDEX custom_fields_name_value ON custom_fields(field_name, field_value);


DROP TABLE IF EXISTS custom_field_history;
CREATE TABLE custom_field_history (
    record_id serial unique,
    id varchar(36) NOT NULL,
    target_record_id bigint /*! unsigned */ not null,
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
    account_record_id bigint /*! unsigned */ not null,
    tenant_record_id bigint /*! unsigned */ not null default 0,
    PRIMARY KEY(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
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
    tenant_record_id bigint /*! unsigned */ not null default 0,
    PRIMARY KEY(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
CREATE UNIQUE INDEX tag_definitions_id ON tag_definitions(id);
CREATE INDEX tag_definitions_tenant_record_id ON tag_definitions(tenant_record_id);

DROP TABLE IF EXISTS tag_definition_history;
CREATE TABLE tag_definition_history (
    record_id serial unique,
    id varchar(36) NOT NULL,
    target_record_id bigint /*! unsigned */ not null,
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
    account_record_id bigint /*! unsigned */ default null,
    tenant_record_id bigint /*! unsigned */ not null default 0,
    PRIMARY KEY(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
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
    account_record_id bigint /*! unsigned */ not null,
    tenant_record_id bigint /*! unsigned */ not null default 0,
    PRIMARY KEY(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
CREATE UNIQUE INDEX tags_id ON tags(id);
CREATE INDEX tags_by_object ON tags(object_id);
CREATE INDEX tags_tenant_account_record_id ON tags(tenant_record_id, account_record_id);

DROP TABLE IF EXISTS tag_history;
CREATE TABLE tag_history (
    record_id serial unique,
    id varchar(36) NOT NULL,
    target_record_id bigint /*! unsigned */ not null,
    object_id varchar(36) NOT NULL,
    object_type varchar(30) NOT NULL,
    tag_definition_id varchar(36) NOT NULL,
    is_active boolean default true,
    change_type varchar(6) NOT NULL,
    created_by varchar(50) NOT NULL,
    created_date datetime NOT NULL,
    updated_by varchar(50) NOT NULL,
    updated_date datetime NOT NULL,
    account_record_id bigint /*! unsigned */ not null,
    tenant_record_id bigint /*! unsigned */ not null default 0,
    PRIMARY KEY(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
CREATE INDEX tag_history_target_record_id ON tag_history(target_record_id);
CREATE INDEX tag_history_by_object ON tag_history(object_id);
CREATE INDEX tag_history_tenant_account_record_id ON tag_history(tenant_record_id, account_record_id);

DROP TABLE IF EXISTS audit_log;
CREATE TABLE audit_log (
    record_id serial unique,
    id varchar(36) NOT NULL,
    target_record_id bigint /*! unsigned */ not null,
    table_name varchar(50) NOT NULL,
    change_type varchar(6) NOT NULL,
    created_date datetime NOT NULL,
    created_by varchar(50) NOT NULL,
    reason_code varchar(255) DEFAULT NULL,
    comments varchar(255) DEFAULT NULL,
    user_token varchar(36),
    /* Note: can be NULL (e.g. tenant_kvs audits) */
    account_record_id bigint /*! unsigned */ default null,
    tenant_record_id bigint /*! unsigned */ not null default 0,
    PRIMARY KEY(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
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
    error_count int /*! unsigned */ DEFAULT 0,
    search_key1 bigint /*! unsigned */ not null,
    search_key2 bigint /*! unsigned */ not null default 0,
    queue_name varchar(64) NOT NULL,
    effective_date datetime NOT NULL,
    future_user_token varchar(36),
    PRIMARY KEY(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
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
    error_count int /*! unsigned */ DEFAULT 0,
    search_key1 bigint /*! unsigned */ not null,
    search_key2 bigint /*! unsigned */ not null default 0,
    queue_name varchar(64) NOT NULL,
    effective_date datetime NOT NULL,
    future_user_token varchar(36),
    PRIMARY KEY(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
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
    error_count int /*! unsigned */ DEFAULT 0,
    /* Note: account_record_id can be NULL (e.g. TagDefinition events) */
    search_key1 bigint /*! unsigned */ default null,
    search_key2 bigint /*! unsigned */ not null default 0,
    PRIMARY KEY(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
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
    error_count int /*! unsigned */ DEFAULT 0,
    /* Note: account_record_id can be NULL (e.g. TagDefinition events) */
    search_key1 bigint /*! unsigned */ default null,
    search_key2 bigint /*! unsigned */ not null default 0,
    PRIMARY KEY(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
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
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
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
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
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
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
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
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
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
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
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
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;



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
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
CREATE UNIQUE INDEX tenants_id ON tenants(id);
CREATE UNIQUE INDEX tenants_api_key ON tenants(api_key);


DROP TABLE IF EXISTS tenant_kvs;
CREATE TABLE tenant_kvs (
   record_id serial unique,
   id varchar(36) NOT NULL,
   tenant_record_id bigint /*! unsigned */ not null default 0,
   tenant_key varchar(255) NOT NULL,
   tenant_value mediumtext NOT NULL,
   is_active boolean default true,
   created_date datetime NOT NULL,
   created_by varchar(50) NOT NULL,
   updated_date datetime DEFAULT NULL,
   updated_by varchar(50) DEFAULT NULL,
   PRIMARY KEY(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
CREATE INDEX tenant_kvs_trid_key ON tenant_kvs(tenant_record_id, tenant_key);


DROP TABLE IF EXISTS tenant_broadcasts;
CREATE TABLE tenant_broadcasts (
   record_id serial unique,
   id varchar(36) NOT NULL,
   /* Note: can be NULL in case of delete */
   target_record_id bigint /*! unsigned */ default null,
   target_table_name varchar(50) NOT NULL,
   tenant_record_id bigint /*! unsigned */ not null default 0,
   type varchar(64) NOT NULL,
   user_token varchar(36),
   created_date datetime NOT NULL,
   created_by varchar(50) NOT NULL,
   updated_date datetime DEFAULT NULL,
   updated_by varchar(50) DEFAULT NULL,
   PRIMARY KEY(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
CREATE INDEX tenant_broadcasts_key ON tenant_broadcasts(tenant_record_id);

-- KAUI DDL
-- https://github.com/killbill/killbill-admin-ui/blob/master/db/ddl.sql

CREATE TABLE kaui_users (
  id serial unique,
  kb_username varchar(255) NOT NULL,
  kb_session_id varchar(255) DEFAULT NULL,
  created_at datetime NOT NULL,
  updated_at datetime NOT NULL,
  PRIMARY KEY (id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
CREATE UNIQUE INDEX index_kaui_users_on_kb_username ON kaui_users(kb_username);

CREATE TABLE kaui_tenants (
  id serial unique,
  name varchar(255) NOT NULL,
  kb_tenant_id varchar(255) DEFAULT NULL,
  api_key varchar(255) DEFAULT NULL,
  encrypted_api_secret varchar(255) DEFAULT NULL,
  created_at datetime NOT NULL,
  updated_at datetime NOT NULL,
  PRIMARY KEY (id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
CREATE UNIQUE INDEX kaui_tenants_kb_name ON kaui_tenants(name);
CREATE UNIQUE INDEX kaui_tenants_kb_tenant_id ON kaui_tenants(kb_tenant_id);
CREATE UNIQUE INDEX kaui_tenants_kb_api_key ON kaui_tenants(api_key);

CREATE TABLE kaui_allowed_users (
  id serial unique,
  kb_username varchar(255) DEFAULT NULL,
  description varchar(255) DEFAULT NULL,
  created_at datetime NOT NULL,
  updated_at datetime NOT NULL,
  PRIMARY KEY (id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
CREATE UNIQUE INDEX kaui_allowed_users_idx ON kaui_allowed_users(kb_username);

CREATE TABLE kaui_allowed_user_tenants (
  id serial unique,
  kaui_allowed_user_id bigint /*! unsigned */ DEFAULT NULL,
  kaui_tenant_id bigint /*! unsigned */ DEFAULT NULL,
  created_at datetime NOT NULL,
  updated_at datetime NOT NULL,
  PRIMARY KEY (id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
CREATE UNIQUE INDEX kaui_allowed_users_tenants_uniq ON kaui_allowed_user_tenants(kaui_allowed_user_id,kaui_tenant_id);

-- PLUGIN DDL

-- PLUGIN DDL -> analytics-plugin
use killbill;

-- PLUGIN DDL -> analytics-plugin -> ddl.sql

-- Subscription events
drop table if exists analytics_subscription_transitions;
create table analytics_subscription_transitions (
  record_id serial unique
, subscription_event_record_id bigint /*! unsigned */ default null
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
, account_record_id bigint /*! unsigned */ default null
, tenant_record_id bigint /*! unsigned */ default null
, report_group varchar(50) not null
, primary key(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
create index analytics_subscription_transitions_bundle_id on analytics_subscription_transitions(bundle_id);
create index analytics_subscription_transitions_bundle_external_key on analytics_subscription_transitions(bundle_external_key);
create index analytics_subscription_transitions_account_id on analytics_subscription_transitions(account_id);
create index analytics_subscription_transitions_account_record_id on analytics_subscription_transitions(account_record_id);
create index analytics_subscription_transitions_tenant_account_record_id on analytics_subscription_transitions(tenant_record_id, account_record_id);

-- Bundle summary
drop table if exists analytics_bundles;
create table analytics_bundles (
  record_id serial unique
, bundle_record_id bigint /*! unsigned */ default null
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
, account_record_id bigint /*! unsigned */ default null
, tenant_record_id bigint /*! unsigned */ default null
, report_group varchar(50) not null
, primary key(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
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
, account_record_id bigint /*! unsigned */ default null
, tenant_record_id bigint /*! unsigned */ default null
, report_group varchar(50) not null
, primary key(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
create index analytics_accounts_account_external_key on analytics_accounts(account_external_key);
create index analytics_accounts_account_id on analytics_accounts(account_id);
create index analytics_accounts_account_record_id on analytics_accounts(account_record_id);
create index analytics_accounts_tenant_account_record_id on analytics_accounts(tenant_record_id, account_record_id);
create index analytics_accounts_created_date_tenant_record_id_report_group on analytics_accounts(created_date, tenant_record_id, report_group);

drop table if exists analytics_account_transitions;
create table analytics_account_transitions (
  record_id serial unique
, blocking_state_record_id bigint /*! unsigned */ default null
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
, account_record_id bigint /*! unsigned */ default null
, tenant_record_id bigint /*! unsigned */ default null
, report_group varchar(50) not null
, primary key(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
create index analytics_account_transitions_account_id on analytics_account_transitions(account_id);
create index analytics_account_transitions_account_record_id on analytics_account_transitions(account_record_id);
create index analytics_account_transitions_tenant_account_record_id on analytics_account_transitions(tenant_record_id, account_record_id);
-- For sanity queries
create index analytics_account_transitions_blocking_state_record_id on analytics_account_transitions(blocking_state_record_id);

-- Invoices
drop table if exists analytics_invoices;
create table analytics_invoices (
  record_id serial unique
, invoice_record_id bigint /*! unsigned */ default null
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
, account_record_id bigint /*! unsigned */ default null
, tenant_record_id bigint /*! unsigned */ default null
, report_group varchar(50) not null
, primary key(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
create index analytics_invoices_invoice_record_id on analytics_invoices(invoice_record_id);
create index analytics_invoices_invoice_id on analytics_invoices(invoice_id);
create index analytics_invoices_account_id on analytics_invoices(account_id);
create index analytics_invoices_account_record_id on analytics_invoices(account_record_id);
create index analytics_invoices_tenant_account_record_id on analytics_invoices(tenant_record_id, account_record_id);

-- Invoice adjustments (type REFUND_ADJ)
drop table if exists analytics_invoice_adjustments;
create table analytics_invoice_adjustments (
  record_id serial unique
, invoice_item_record_id bigint /*! unsigned */ default null
, second_invoice_item_record_id bigint /*! unsigned */ default null
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
, account_record_id bigint /*! unsigned */ default null
, tenant_record_id bigint /*! unsigned */ default null
, report_group varchar(50) not null
, primary key(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
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
, invoice_item_record_id bigint /*! unsigned */ default null
, second_invoice_item_record_id bigint /*! unsigned */ default null
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
, account_record_id bigint /*! unsigned */ default null
, tenant_record_id bigint /*! unsigned */ default null
, report_group varchar(50) not null
, primary key(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
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
, invoice_item_record_id bigint /*! unsigned */ default null
, second_invoice_item_record_id bigint /*! unsigned */ default null
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
, account_record_id bigint /*! unsigned */ default null
, tenant_record_id bigint /*! unsigned */ default null
, report_group varchar(50) not null
, primary key(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
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
, invoice_item_record_id bigint /*! unsigned */ default null
, second_invoice_item_record_id bigint /*! unsigned */ default null
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
, account_record_id bigint /*! unsigned */ default null
, tenant_record_id bigint /*! unsigned */ default null
, report_group varchar(50) not null
, primary key(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
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
, invoice_payment_record_id bigint /*! unsigned */ default null
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
, account_record_id bigint /*! unsigned */ default null
, tenant_record_id bigint /*! unsigned */ default null
, report_group varchar(50) not null
, primary key(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
create index analytics_payment_auths_created_date on analytics_payment_auths(created_date);
create index analytics_payment_auths_date_trid_plugin_name on analytics_payment_auths(created_date, tenant_record_id, plugin_name);
create index analytics_payment_auths_invoice_payment_record_id on analytics_payment_auths(invoice_payment_record_id);
create index analytics_payment_auths_invoice_payment_id on analytics_payment_auths(invoice_payment_id);
create index analytics_payment_auths_invoice_id on analytics_payment_auths(invoice_id);
create index analytics_payment_auths_account_id on analytics_payment_auths(account_id);
create index analytics_payment_auths_account_record_id on analytics_payment_auths(account_record_id);
create index analytics_payment_auths_tenant_account_record_id on analytics_payment_auths(tenant_record_id, account_record_id);
create index analytics_payment_auths_cdate_trid_crcy_status_rgroup_camount on analytics_payment_auths(created_date, tenant_record_id, currency, payment_transaction_status, report_group, converted_amount);
create index ap_auths_cdate_trid_crcy_status_rgroup_camount_pname_perror on analytics_payment_auths(created_date, tenant_record_id, currency, payment_transaction_status, report_group, plugin_name /*! , plugin_gateway_error(80) */);

drop table if exists analytics_payment_captures;
create table analytics_payment_captures (
  record_id serial unique
, invoice_payment_record_id bigint /*! unsigned */ default null
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
, account_record_id bigint /*! unsigned */ default null
, tenant_record_id bigint /*! unsigned */ default null
, report_group varchar(50) not null
, primary key(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
create index analytics_payment_captures_created_date on analytics_payment_captures(created_date);
create index analytics_payment_captures_date_trid_plugin_name on analytics_payment_captures(created_date, tenant_record_id, plugin_name);
create index analytics_payment_captures_invoice_payment_record_id on analytics_payment_captures(invoice_payment_record_id);
create index analytics_payment_captures_invoice_payment_id on analytics_payment_captures(invoice_payment_id);
create index analytics_payment_captures_invoice_id on analytics_payment_captures(invoice_id);
create index analytics_payment_captures_account_id on analytics_payment_captures(account_id);
create index analytics_payment_captures_account_record_id on analytics_payment_captures(account_record_id);
create index analytics_payment_captures_tenant_account_record_id on analytics_payment_captures(tenant_record_id, account_record_id);
create index analytics_payment_captures_cdate_trid_crcy_status_rgroup_camount on analytics_payment_captures(created_date, tenant_record_id, currency, payment_transaction_status, report_group, converted_amount);
create index ap_captures_cdate_trid_crcy_status_rgroup_camount_pname_perror on analytics_payment_captures(created_date, tenant_record_id, currency, payment_transaction_status, report_group, plugin_name /*! , plugin_gateway_error(80) */);

drop table if exists analytics_payment_purchases;
create table analytics_payment_purchases (
  record_id serial unique
, invoice_payment_record_id bigint /*! unsigned */ default null
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
, account_record_id bigint /*! unsigned */ default null
, tenant_record_id bigint /*! unsigned */ default null
, report_group varchar(50) not null
, primary key(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
create index analytics_payment_purchases_created_date on analytics_payment_purchases(created_date);
create index analytics_payment_purchases_date_trid_plugin_name on analytics_payment_purchases(created_date, tenant_record_id, plugin_name);
create index analytics_payment_purchases_invoice_payment_record_id on analytics_payment_purchases(invoice_payment_record_id);
create index analytics_payment_purchases_invoice_payment_id on analytics_payment_purchases(invoice_payment_id);
create index analytics_payment_purchases_invoice_id on analytics_payment_purchases(invoice_id);
create index analytics_payment_purchases_account_id on analytics_payment_purchases(account_id);
create index analytics_payment_purchases_account_record_id on analytics_payment_purchases(account_record_id);
create index analytics_payment_purchases_tenant_account_record_id on analytics_payment_purchases(tenant_record_id, account_record_id);
create index analytics_payment_prchses_cdate_trid_crcy_status_rgroup_camount on analytics_payment_purchases(created_date, tenant_record_id, currency, payment_transaction_status, report_group, converted_amount);
create index ap_prchses_cdate_trid_crcy_status_rgroup_camount_pname_perror on analytics_payment_purchases(created_date, tenant_record_id, currency, payment_transaction_status, report_group, plugin_name /*! , plugin_gateway_error(80) */);

drop table if exists analytics_payment_refunds;
create table analytics_payment_refunds (
  record_id serial unique
, invoice_payment_record_id bigint /*! unsigned */ default null
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
, account_record_id bigint /*! unsigned */ default null
, tenant_record_id bigint /*! unsigned */ default null
, report_group varchar(50) not null
, primary key(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
create index analytics_payment_refunds_created_date on analytics_payment_refunds(created_date);
create index analytics_payment_refunds_date_trid_plugin_name on analytics_payment_refunds(created_date, tenant_record_id, plugin_name);
create index analytics_payment_refunds_invoice_payment_record_id on analytics_payment_refunds(invoice_payment_record_id);
create index analytics_payment_refunds_invoice_payment_id on analytics_payment_refunds(invoice_payment_id);
create index analytics_payment_refunds_invoice_id on analytics_payment_refunds(invoice_id);
create index analytics_payment_refunds_account_id on analytics_payment_refunds(account_id);
create index analytics_payment_refunds_account_record_id on analytics_payment_refunds(account_record_id);
create index analytics_payment_refunds_tenant_account_record_id on analytics_payment_refunds(tenant_record_id, account_record_id);
create index analytics_payment_refunds_cdate_trid_crcy_status_rgroup_camount on analytics_payment_refunds(created_date, tenant_record_id, currency, payment_transaction_status, report_group, converted_amount);
create index ap_refunds_cdate_trid_crcy_status_rgroup_camount_pname_perror on analytics_payment_refunds(created_date, tenant_record_id, currency, payment_transaction_status, report_group, plugin_name /*! , plugin_gateway_error(80) */);

drop table if exists analytics_payment_credits;
create table analytics_payment_credits (
  record_id serial unique
, invoice_payment_record_id bigint /*! unsigned */ default null
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
, account_record_id bigint /*! unsigned */ default null
, tenant_record_id bigint /*! unsigned */ default null
, report_group varchar(50) not null
, primary key(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
create index analytics_payment_credits_created_date on analytics_payment_credits(created_date);
create index analytics_payment_credits_date_trid_plugin_name on analytics_payment_credits(created_date, tenant_record_id, plugin_name);
create index analytics_payment_credits_invoice_payment_record_id on analytics_payment_credits(invoice_payment_record_id);
create index analytics_payment_credits_invoice_payment_id on analytics_payment_credits(invoice_payment_id);
create index analytics_payment_credits_invoice_id on analytics_payment_credits(invoice_id);
create index analytics_payment_credits_account_id on analytics_payment_credits(account_id);
create index analytics_payment_credits_account_record_id on analytics_payment_credits(account_record_id);
create index analytics_payment_credits_tenant_account_record_id on analytics_payment_credits(tenant_record_id, account_record_id);
create index analytics_payment_credits_cdate_trid_crcy_status_rgroup_camount on analytics_payment_credits(created_date, tenant_record_id, currency, payment_transaction_status, report_group, converted_amount);
create index ap_credits_cdate_trid_crcy_status_rgroup_camount_pname_perror on analytics_payment_credits(created_date, tenant_record_id, currency, payment_transaction_status, report_group, plugin_name /*! , plugin_gateway_error(80) */);

drop table if exists analytics_payment_chargebacks;
create table analytics_payment_chargebacks (
  record_id serial unique
, invoice_payment_record_id bigint /*! unsigned */ default null
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
, account_record_id bigint /*! unsigned */ default null
, tenant_record_id bigint /*! unsigned */ default null
, report_group varchar(50) not null
, primary key(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
create index analytics_payment_chargebacks_created_date on analytics_payment_chargebacks(created_date);
create index analytics_payment_chargebacks_date_trid_plugin_name on analytics_payment_chargebacks(created_date, tenant_record_id, plugin_name);
create index analytics_payment_chargebacks_invoice_payment_record_id on analytics_payment_chargebacks(invoice_payment_record_id);
create index analytics_payment_chargebacks_invoice_payment_id on analytics_payment_chargebacks(invoice_payment_id);
create index analytics_payment_chargebacks_invoice_id on analytics_payment_chargebacks(invoice_id);
create index analytics_payment_chargebacks_account_id on analytics_payment_chargebacks(account_id);
create index analytics_payment_chargebacks_account_record_id on analytics_payment_chargebacks(account_record_id);
create index analytics_payment_chargebacks_tenant_account_record_id on analytics_payment_chargebacks(tenant_record_id, account_record_id);
create index analytics_payment_cbacks_cdate_trid_crcy_status_rgroup_camount on analytics_payment_chargebacks(created_date, tenant_record_id, currency, payment_transaction_status, report_group, converted_amount);
create index ap_cbacks_cdate_trid_crcy_status_rgroup_camount_pname_perror on analytics_payment_chargebacks(created_date, tenant_record_id, currency, payment_transaction_status, report_group, plugin_name /*! , plugin_gateway_error(80) */);

drop table if exists analytics_payment_voids;
create table analytics_payment_voids (
  record_id serial unique
, invoice_payment_record_id bigint /*! unsigned */ default null
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
, account_record_id bigint /*! unsigned */ default null
, tenant_record_id bigint /*! unsigned */ default null
, report_group varchar(50) not null
, primary key(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
create index analytics_payment_voids_created_date on analytics_payment_voids(created_date);
create index analytics_payment_voids_date_trid_plugin_name on analytics_payment_voids(created_date, tenant_record_id, plugin_name);
create index analytics_payment_voids_invoice_payment_record_id on analytics_payment_voids(invoice_payment_record_id);
create index analytics_payment_voids_invoice_payment_id on analytics_payment_voids(invoice_payment_id);
create index analytics_payment_voids_invoice_id on analytics_payment_voids(invoice_id);
create index analytics_payment_voids_account_id on analytics_payment_voids(account_id);
create index analytics_payment_voids_account_record_id on analytics_payment_voids(account_record_id);
create index analytics_payment_voids_tenant_account_record_id on analytics_payment_voids(tenant_record_id, account_record_id);
create index analytics_payment_voids_cdate_trid_crcy_status_rgroup_camount on analytics_payment_voids(created_date, tenant_record_id, currency, payment_transaction_status, report_group, converted_amount);
create index ap_voids_cdate_trid_crcy_status_rgroup_camount_pname_perror on analytics_payment_voids(created_date, tenant_record_id, currency, payment_transaction_status, report_group, plugin_name /*! , plugin_gateway_error(80) */);

-- Tags

drop table if exists analytics_account_tags;
create table analytics_account_tags (
  record_id serial unique
, tag_record_id bigint /*! unsigned */ default null
, name varchar(50) default null
, created_date datetime default null
, created_by varchar(50) default null
, created_reason_code varchar(255) default null
, created_comments varchar(255) default null
, account_id varchar(36) default null
, account_name varchar(100) default null
, account_external_key varchar(255) default null
, account_record_id bigint /*! unsigned */ default null
, tenant_record_id bigint /*! unsigned */ default null
, report_group varchar(50) not null
, primary key(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
create index analytics_account_tags_account_id on analytics_account_tags(account_id);
create index analytics_account_tags_account_record_id on analytics_account_tags(account_record_id);
create index analytics_account_tags_tenant_account_record_id on analytics_account_tags(tenant_record_id, account_record_id);

drop table if exists analytics_bundle_tags;
create table analytics_bundle_tags (
  record_id serial unique
, tag_record_id bigint /*! unsigned */ default null
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
, account_record_id bigint /*! unsigned */ default null
, tenant_record_id bigint /*! unsigned */ default null
, report_group varchar(50) not null
, primary key(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
create index analytics_bundle_tags_account_id on analytics_bundle_tags(account_id);
create index analytics_bundle_tags_bundle_id on analytics_bundle_tags(bundle_id);
create index analytics_bundle_tags_bundle_external_key on analytics_bundle_tags(bundle_external_key);
create index analytics_bundle_tags_account_record_id on analytics_bundle_tags(account_record_id);
create index analytics_bundle_tags_tenant_account_record_id on analytics_bundle_tags(tenant_record_id, account_record_id);

drop table if exists analytics_invoice_tags;
create table analytics_invoice_tags (
  record_id serial unique
, tag_record_id bigint /*! unsigned */ default null
, invoice_id varchar(36) default null
, name varchar(50) default null
, created_date datetime default null
, created_by varchar(50) default null
, created_reason_code varchar(255) default null
, created_comments varchar(255) default null
, account_id varchar(36) default null
, account_name varchar(100) default null
, account_external_key varchar(255) default null
, account_record_id bigint /*! unsigned */ default null
, tenant_record_id bigint /*! unsigned */ default null
, report_group varchar(50) not null
, primary key(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
create index analytics_invoice_tags_account_id on analytics_invoice_tags(account_id);
create index analytics_invoice_tags_account_record_id on analytics_invoice_tags(account_record_id);
create index analytics_invoice_tags_tenant_account_record_id on analytics_invoice_tags(tenant_record_id, account_record_id);

drop table if exists analytics_payment_tags;
create table analytics_payment_tags (
  record_id serial unique
, tag_record_id bigint /*! unsigned */ default null
, invoice_payment_id varchar(36) default null
, name varchar(50) default null
, created_date datetime default null
, created_by varchar(50) default null
, created_reason_code varchar(255) default null
, created_comments varchar(255) default null
, account_id varchar(36) default null
, account_name varchar(100) default null
, account_external_key varchar(255) default null
, account_record_id bigint /*! unsigned */ default null
, tenant_record_id bigint /*! unsigned */ default null
, report_group varchar(50) not null
, primary key(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
create index analytics_payment_tags_account_id on analytics_payment_tags(account_id);
create index analytics_payment_tags_account_record_id on analytics_payment_tags(account_record_id);
create index analytics_payment_tags_tenant_account_record_id on analytics_payment_tags(tenant_record_id, account_record_id);

drop table if exists analytics_account_fields;
create table analytics_account_fields (
  record_id serial unique
, custom_field_record_id bigint /*! unsigned */ default null
, name varchar(64) default null
, value varchar(255) default null
, created_date datetime default null
, created_by varchar(50) default null
, created_reason_code varchar(255) default null
, created_comments varchar(255) default null
, account_id varchar(36) default null
, account_name varchar(100) default null
, account_external_key varchar(255) default null
, account_record_id bigint /*! unsigned */ default null
, tenant_record_id bigint /*! unsigned */ default null
, report_group varchar(50) not null
, primary key(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
create index analytics_account_fields_account_id on analytics_account_fields(account_id);
create index analytics_account_fields_account_record_id on analytics_account_fields(account_record_id);
create index analytics_account_fields_tenant_account_record_id on analytics_account_fields(tenant_record_id, account_record_id);

drop table if exists analytics_bundle_fields;
create table analytics_bundle_fields (
  record_id serial unique
, custom_field_record_id bigint /*! unsigned */ default null
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
, account_record_id bigint /*! unsigned */ default null
, tenant_record_id bigint /*! unsigned */ default null
, report_group varchar(50) not null
, primary key(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
create index analytics_bundle_fields_account_id on analytics_bundle_fields(account_id);
create index analytics_bundle_fields_bundle_id on analytics_bundle_fields(bundle_id);
create index analytics_bundle_fields_bundle_external_key on analytics_bundle_fields(bundle_external_key);
create index analytics_bundle_fields_account_record_id on analytics_bundle_fields(account_record_id);
create index analytics_bundle_fields_tenant_account_record_id on analytics_bundle_fields(tenant_record_id, account_record_id);

drop table if exists analytics_invoice_fields;
create table analytics_invoice_fields (
  record_id serial unique
, custom_field_record_id bigint /*! unsigned */ default null
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
, account_record_id bigint /*! unsigned */ default null
, tenant_record_id bigint /*! unsigned */ default null
, report_group varchar(50) not null
, primary key(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
create index analytics_invoice_fields_account_id on analytics_invoice_fields(account_id);
create index analytics_invoice_fields_account_record_id on analytics_invoice_fields(account_record_id);
create index analytics_invoice_fields_tenant_account_record_id on analytics_invoice_fields(tenant_record_id, account_record_id);

drop table if exists analytics_invoice_payment_fields;
create table analytics_invoice_payment_fields (
  record_id serial unique
, custom_field_record_id bigint /*! unsigned */ default null
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
, account_record_id bigint /*! unsigned */ default null
, tenant_record_id bigint /*! unsigned */ default null
, report_group varchar(50) not null
, primary key(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
create index analytics_invoice_payment_fields_account_id on analytics_invoice_payment_fields(account_id);
create index analytics_invoice_payment_fields_account_record_id on analytics_invoice_payment_fields(account_record_id);
create index analytics_invoice_payment_fields_tenant_account_record_id on analytics_invoice_payment_fields(tenant_record_id, account_record_id);

drop table if exists analytics_payment_fields;
create table analytics_payment_fields (
  record_id serial unique
, custom_field_record_id bigint /*! unsigned */ default null
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
, account_record_id bigint /*! unsigned */ default null
, tenant_record_id bigint /*! unsigned */ default null
, report_group varchar(50) not null
, primary key(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
create index analytics_payment_fields_account_id on analytics_payment_fields(account_id);
create index analytics_payment_fields_account_record_id on analytics_payment_fields(account_record_id);
create index analytics_payment_fields_tenant_account_record_id on analytics_payment_fields(tenant_record_id, account_record_id);

drop table if exists analytics_payment_method_fields;
create table analytics_payment_method_fields (
  record_id serial unique
, custom_field_record_id bigint /*! unsigned */ default null
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
, account_record_id bigint /*! unsigned */ default null
, tenant_record_id bigint /*! unsigned */ default null
, report_group varchar(50) not null
, primary key(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
create index analytics_payment_method_fields_account_id on analytics_payment_method_fields(account_id);
create index analytics_payment_method_fields_account_record_id on analytics_payment_method_fields(account_record_id);
create index analytics_payment_method_fields_tenant_account_record_id on analytics_payment_method_fields(tenant_record_id, account_record_id);

drop table if exists analytics_transaction_fields;
create table analytics_transaction_fields (
  record_id serial unique
, custom_field_record_id bigint /*! unsigned */ default null
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
, account_record_id bigint /*! unsigned */ default null
, tenant_record_id bigint /*! unsigned */ default null
, report_group varchar(50) not null
, primary key(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
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
, error_count int /*! unsigned */ DEFAULT 0
, search_key1 int /*! unsigned */ default null
, search_key2 int /*! unsigned */ default null
, queue_name varchar(64) not null
, effective_date datetime not null
, future_user_token varchar(36)
, primary key(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
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
, error_count int /*! unsigned */ DEFAULT 0
, search_key1 int /*! unsigned */ default null
, search_key2 int /*! unsigned */ default null
, queue_name varchar(64) not null
, effective_date datetime not null
, future_user_token varchar(36)
, primary key(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;

drop table if exists analytics_currency_conversion;
create table analytics_currency_conversion (
  record_id serial unique
, currency varchar(3) not null
, start_date date not null
, end_date date not null
, reference_rate decimal(10, 4) not null
, reference_currency varchar(3) default 'USD'
, primary key(record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
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
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
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


-- PLUGIN DDL -> killbill-email-notifications-plugin
use killbill

-- PLUGIN DDL -> killbill-email-notifications-plugin -> ddl.sql
DROP table If exists email_notifications_configuration;
CREATE TABLE email_notifications_configuration (
  record_id serial unique,
  kb_account_id varchar(255) NOT NULL,
  kb_tenant_id varchar(255) NOT NULL,
  event_type varchar(255) NOT NULL,
  created_at datetime NOT NULL,
  PRIMARY KEY (record_id)
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
CREATE UNIQUE INDEX email_notifications_configuration_event_type_kb_account_id ON email_notifications_configuration(event_type, kb_account_id);
CREATE INDEX email_notifications_configuration_kb_account_id ON email_notifications_configuration(kb_account_id);
CREATE INDEX email_notifications_configuration_kb_tenant_id ON email_notifications_configuration(kb_tenant_id);
CREATE INDEX email_notifications_configuration_event_type_kb_tenant_id ON email_notifications_configuration(event_type, kb_tenant_id);

-- PLUGIN DDL -> stripe-plugin
use killbill
drop table if exists stripe_hpp_requests;
drop table if exists stripe_responses;
drop table if exists stripe_payment_methods;

-- PLUGIN DDL -> stripe-plugin -> ddl.sql

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
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
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
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
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
) /*! CHARACTER SET utf8 COLLATE utf8_bin */;
create unique index stripe_payment_methods_kb_payment_id on stripe_payment_methods(kb_payment_method_id);
create index stripe_payment_methods_stripe_id on stripe_payment_methods(stripe_id);

