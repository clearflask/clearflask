/*
 * This file is generated by jOOQ.
 */
package com.smotana.clearflask.store.mysql.model.tables;


import com.smotana.clearflask.store.mysql.LocalDateTimeToInstantBinding;
import com.smotana.clearflask.store.mysql.model.DefaultSchema;
import com.smotana.clearflask.store.mysql.model.JooqKeys;
import com.smotana.clearflask.store.mysql.model.tables.records.JooqAccountRecord;

import java.time.Instant;

import org.jooq.Field;
import org.jooq.ForeignKey;
import org.jooq.Name;
import org.jooq.Record;
import org.jooq.Row6;
import org.jooq.Schema;
import org.jooq.Table;
import org.jooq.TableField;
import org.jooq.TableOptions;
import org.jooq.UniqueKey;
import org.jooq.impl.DSL;
import org.jooq.impl.SQLDataType;
import org.jooq.impl.TableImpl;


/**
 * This class is generated by jOOQ.
 */
@SuppressWarnings({ "all", "unchecked", "rawtypes" })
public class JooqAccount extends TableImpl<JooqAccountRecord> {

    private static final long serialVersionUID = 1L;

    /**
     * The reference instance of <code>account</code>
     */
    public static final JooqAccount ACCOUNT = new JooqAccount();

    /**
     * The class holding records for this type
     */
    @Override
    public Class<JooqAccountRecord> getRecordType() {
        return JooqAccountRecord.class;
    }

    /**
     * The column <code>account.accountId</code>.
     */
    public final TableField<JooqAccountRecord, String> ACCOUNTID = createField(DSL.name("accountId"), SQLDataType.VARCHAR(255).nullable(false), this, "");

    /**
     * The column <code>account.name</code>.
     */
    public final TableField<JooqAccountRecord, String> NAME = createField(DSL.name("name"), SQLDataType.VARCHAR(255).nullable(false), this, "");

    /**
     * The column <code>account.email</code>.
     */
    public final TableField<JooqAccountRecord, String> EMAIL = createField(DSL.name("email"), SQLDataType.VARCHAR(255).nullable(false), this, "");

    /**
     * The column <code>account.status</code>.
     */
    public final TableField<JooqAccountRecord, String> STATUS = createField(DSL.name("status"), SQLDataType.VARCHAR(255).nullable(false), this, "");

    /**
     * The column <code>account.planid</code>.
     */
    public final TableField<JooqAccountRecord, String> PLANID = createField(DSL.name("planid"), SQLDataType.VARCHAR(255).nullable(false), this, "");

    /**
     * The column <code>account.created</code>.
     */
    public final TableField<JooqAccountRecord, Instant> CREATED = createField(DSL.name("created"), SQLDataType.LOCALDATETIME(6).nullable(false), this, "", new LocalDateTimeToInstantBinding());

    private JooqAccount(Name alias, Table<JooqAccountRecord> aliased) {
        this(alias, aliased, null);
    }

    private JooqAccount(Name alias, Table<JooqAccountRecord> aliased, Field<?>[] parameters) {
        super(alias, null, aliased, parameters, DSL.comment(""), TableOptions.table());
    }

    /**
     * Create an aliased <code>account</code> table reference
     */
    public JooqAccount(String alias) {
        this(DSL.name(alias), ACCOUNT);
    }

    /**
     * Create an aliased <code>account</code> table reference
     */
    public JooqAccount(Name alias) {
        this(alias, ACCOUNT);
    }

    /**
     * Create a <code>account</code> table reference
     */
    public JooqAccount() {
        this(DSL.name("account"), null);
    }

    public <O extends Record> JooqAccount(Table<O> child, ForeignKey<O, JooqAccountRecord> key) {
        super(child, key, ACCOUNT);
    }

    @Override
    public Schema getSchema() {
        return aliased() ? null : DefaultSchema.DEFAULT_SCHEMA;
    }

    @Override
    public UniqueKey<JooqAccountRecord> getPrimaryKey() {
        return JooqKeys.KEY_ACCOUNT_PRIMARY;
    }

    @Override
    public JooqAccount as(String alias) {
        return new JooqAccount(DSL.name(alias), this);
    }

    @Override
    public JooqAccount as(Name alias) {
        return new JooqAccount(alias, this);
    }

    /**
     * Rename this table
     */
    @Override
    public JooqAccount rename(String name) {
        return new JooqAccount(DSL.name(name), null);
    }

    /**
     * Rename this table
     */
    @Override
    public JooqAccount rename(Name name) {
        return new JooqAccount(name, null);
    }

    // -------------------------------------------------------------------------
    // Row6 type methods
    // -------------------------------------------------------------------------

    @Override
    public Row6<String, String, String, String, String, Instant> fieldsRow() {
        return (Row6) super.fieldsRow();
    }
}