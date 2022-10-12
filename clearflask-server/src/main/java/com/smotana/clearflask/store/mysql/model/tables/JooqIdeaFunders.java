/*
 * This file is generated by jOOQ.
 */
package com.smotana.clearflask.store.mysql.model.tables;


import com.smotana.clearflask.store.mysql.model.DefaultSchema;
import com.smotana.clearflask.store.mysql.model.JooqIndexes;
import com.smotana.clearflask.store.mysql.model.JooqKeys;
import com.smotana.clearflask.store.mysql.model.tables.records.JooqIdeaFundersRecord;

import java.util.Arrays;
import java.util.List;

import javax.annotation.processing.Generated;

import org.jooq.Field;
import org.jooq.ForeignKey;
import org.jooq.Index;
import org.jooq.Name;
import org.jooq.Record;
import org.jooq.Row3;
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
@Generated(
    value = {
        "https://www.jooq.org",
        "jOOQ version:3.16.10"
    },
    comments = "This class is generated by jOOQ"
)
@SuppressWarnings({ "all", "unchecked", "rawtypes" })
public class JooqIdeaFunders extends TableImpl<JooqIdeaFundersRecord> {

    private static final long serialVersionUID = 1L;

    /**
     * The reference instance of <code>idea_funders</code>
     */
    public static final JooqIdeaFunders IDEA_FUNDERS = new JooqIdeaFunders();

    /**
     * The class holding records for this type
     */
    @Override
    public Class<JooqIdeaFundersRecord> getRecordType() {
        return JooqIdeaFundersRecord.class;
    }

    /**
     * The column <code>idea_funders.projectId</code>.
     */
    public final TableField<JooqIdeaFundersRecord, String> PROJECTID = createField(DSL.name("projectId"), SQLDataType.VARCHAR(54).nullable(false), this, "");

    /**
     * The column <code>idea_funders.postId</code>.
     */
    public final TableField<JooqIdeaFundersRecord, String> POSTID = createField(DSL.name("postId"), SQLDataType.VARCHAR(54).nullable(false), this, "");

    /**
     * The column <code>idea_funders.funderUserId</code>.
     */
    public final TableField<JooqIdeaFundersRecord, String> FUNDERUSERID = createField(DSL.name("funderUserId"), SQLDataType.VARCHAR(54).nullable(false), this, "");

    private JooqIdeaFunders(Name alias, Table<JooqIdeaFundersRecord> aliased) {
        this(alias, aliased, null);
    }

    private JooqIdeaFunders(Name alias, Table<JooqIdeaFundersRecord> aliased, Field<?>[] parameters) {
        super(alias, null, aliased, parameters, DSL.comment(""), TableOptions.table());
    }

    /**
     * Create an aliased <code>idea_funders</code> table reference
     */
    public JooqIdeaFunders(String alias) {
        this(DSL.name(alias), IDEA_FUNDERS);
    }

    /**
     * Create an aliased <code>idea_funders</code> table reference
     */
    public JooqIdeaFunders(Name alias) {
        this(alias, IDEA_FUNDERS);
    }

    /**
     * Create a <code>idea_funders</code> table reference
     */
    public JooqIdeaFunders() {
        this(DSL.name("idea_funders"), null);
    }

    public <O extends Record> JooqIdeaFunders(Table<O> child, ForeignKey<O, JooqIdeaFundersRecord> key) {
        super(child, key, IDEA_FUNDERS);
    }

    @Override
    public Schema getSchema() {
        return aliased() ? null : DefaultSchema.DEFAULT_SCHEMA;
    }

    @Override
    public List<Index> getIndexes() {
        return Arrays.asList(JooqIndexes.IDEA_FUNDERS_PROJECTID);
    }

    @Override
    public UniqueKey<JooqIdeaFundersRecord> getPrimaryKey() {
        return JooqKeys.KEY_IDEA_FUNDERS_PRIMARY;
    }

    @Override
    public List<ForeignKey<JooqIdeaFundersRecord, ?>> getReferences() {
        return Arrays.asList(JooqKeys.IDEA_FUNDERS_IBFK_1, JooqKeys.IDEA_FUNDERS_IBFK_2);
    }

    private transient JooqIdea _idea;
    private transient JooqUser _user;

    /**
     * Get the implicit join path to the <code>clearflask.idea</code> table.
     */
    public JooqIdea idea() {
        if (_idea == null)
            _idea = new JooqIdea(this, JooqKeys.IDEA_FUNDERS_IBFK_1);

        return _idea;
    }

    /**
     * Get the implicit join path to the <code>clearflask.user</code> table.
     */
    public JooqUser user() {
        if (_user == null)
            _user = new JooqUser(this, JooqKeys.IDEA_FUNDERS_IBFK_2);

        return _user;
    }

    @Override
    public JooqIdeaFunders as(String alias) {
        return new JooqIdeaFunders(DSL.name(alias), this);
    }

    @Override
    public JooqIdeaFunders as(Name alias) {
        return new JooqIdeaFunders(alias, this);
    }

    /**
     * Rename this table
     */
    @Override
    public JooqIdeaFunders rename(String name) {
        return new JooqIdeaFunders(DSL.name(name), null);
    }

    /**
     * Rename this table
     */
    @Override
    public JooqIdeaFunders rename(Name name) {
        return new JooqIdeaFunders(name, null);
    }

    // -------------------------------------------------------------------------
    // Row3 type methods
    // -------------------------------------------------------------------------

    @Override
    public Row3<String, String, String> fieldsRow() {
        return (Row3) super.fieldsRow();
    }
}
