/*
 * This file is generated by jOOQ.
 */
package com.smotana.clearflask.store.mysql.model.tables;


import com.smotana.clearflask.store.mysql.LocalDateTimeToInstantBinding;
import com.smotana.clearflask.store.mysql.model.DefaultSchema;
import com.smotana.clearflask.store.mysql.model.JooqIndexes;
import com.smotana.clearflask.store.mysql.model.JooqKeys;
import com.smotana.clearflask.store.mysql.model.tables.records.JooqUserRecord;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;

import org.jooq.Field;
import org.jooq.ForeignKey;
import org.jooq.Index;
import org.jooq.Name;
import org.jooq.Record;
import org.jooq.Row7;
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
public class JooqUser extends TableImpl<JooqUserRecord> {

    private static final long serialVersionUID = 1L;

    /**
     * The reference instance of <code>user</code>
     */
    public static final JooqUser USER = new JooqUser();

    /**
     * The class holding records for this type
     */
    @Override
    public Class<JooqUserRecord> getRecordType() {
        return JooqUserRecord.class;
    }

    /**
     * The column <code>user.projectId</code>.
     */
    public final TableField<JooqUserRecord, String> PROJECTID = createField(DSL.name("projectId"), SQLDataType.VARCHAR(255).nullable(false), this, "");

    /**
     * The column <code>user.userId</code>.
     */
    public final TableField<JooqUserRecord, String> USERID = createField(DSL.name("userId"), SQLDataType.VARCHAR(255).nullable(false), this, "");

    /**
     * The column <code>user.name</code>.
     */
    public final TableField<JooqUserRecord, String> NAME = createField(DSL.name("name"), SQLDataType.VARCHAR(255), this, "");

    /**
     * The column <code>user.email</code>.
     */
    public final TableField<JooqUserRecord, String> EMAIL = createField(DSL.name("email"), SQLDataType.VARCHAR(255), this, "");

    /**
     * The column <code>user.created</code>.
     */
    public final TableField<JooqUserRecord, Instant> CREATED = createField(DSL.name("created"), SQLDataType.LOCALDATETIME(6).nullable(false), this, "", new LocalDateTimeToInstantBinding());

    /**
     * The column <code>user.balance</code>.
     */
    public final TableField<JooqUserRecord, Long> BALANCE = createField(DSL.name("balance"), SQLDataType.BIGINT, this, "");

    /**
     * The column <code>user.isMod</code>.
     */
    public final TableField<JooqUserRecord, Boolean> ISMOD = createField(DSL.name("isMod"), SQLDataType.BOOLEAN, this, "");

    private JooqUser(Name alias, Table<JooqUserRecord> aliased) {
        this(alias, aliased, null);
    }

    private JooqUser(Name alias, Table<JooqUserRecord> aliased, Field<?>[] parameters) {
        super(alias, null, aliased, parameters, DSL.comment(""), TableOptions.table());
    }

    /**
     * Create an aliased <code>user</code> table reference
     */
    public JooqUser(String alias) {
        this(DSL.name(alias), USER);
    }

    /**
     * Create an aliased <code>user</code> table reference
     */
    public JooqUser(Name alias) {
        this(alias, USER);
    }

    /**
     * Create a <code>user</code> table reference
     */
    public JooqUser() {
        this(DSL.name("user"), null);
    }

    public <O extends Record> JooqUser(Table<O> child, ForeignKey<O, JooqUserRecord> key) {
        super(child, key, USER);
    }

    @Override
    public Schema getSchema() {
        return aliased() ? null : DefaultSchema.DEFAULT_SCHEMA;
    }

    @Override
    public List<Index> getIndexes() {
        return Arrays.asList(JooqIndexes.USER_USER_ISMOD_IDX, JooqIndexes.USER_USER_PROJECTID_IDX);
    }

    @Override
    public UniqueKey<JooqUserRecord> getPrimaryKey() {
        return JooqKeys.KEY_USER_PRIMARY;
    }

    @Override
    public JooqUser as(String alias) {
        return new JooqUser(DSL.name(alias), this);
    }

    @Override
    public JooqUser as(Name alias) {
        return new JooqUser(alias, this);
    }

    /**
     * Rename this table
     */
    @Override
    public JooqUser rename(String name) {
        return new JooqUser(DSL.name(name), null);
    }

    /**
     * Rename this table
     */
    @Override
    public JooqUser rename(Name name) {
        return new JooqUser(name, null);
    }

    // -------------------------------------------------------------------------
    // Row7 type methods
    // -------------------------------------------------------------------------

    @Override
    public Row7<String, String, String, String, Instant, Long, Boolean> fieldsRow() {
        return (Row7) super.fieldsRow();
    }
}
