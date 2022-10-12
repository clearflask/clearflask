/*
 * This file is generated by jOOQ.
 */
package com.smotana.clearflask.store.mysql.model.tables;


import com.smotana.clearflask.store.mysql.model.DefaultSchema;
import com.smotana.clearflask.store.mysql.model.JooqKeys;
import com.smotana.clearflask.store.mysql.model.tables.records.JooqIdeaTagsRecord;

import java.util.Arrays;
import java.util.List;

import javax.annotation.processing.Generated;

import org.jooq.Field;
import org.jooq.ForeignKey;
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
public class JooqIdeaTags extends TableImpl<JooqIdeaTagsRecord> {

    private static final long serialVersionUID = 1L;

    /**
     * The reference instance of <code>idea_tags</code>
     */
    public static final JooqIdeaTags IDEA_TAGS = new JooqIdeaTags();

    /**
     * The class holding records for this type
     */
    @Override
    public Class<JooqIdeaTagsRecord> getRecordType() {
        return JooqIdeaTagsRecord.class;
    }

    /**
     * The column <code>idea_tags.projectId</code>.
     */
    public final TableField<JooqIdeaTagsRecord, String> PROJECTID = createField(DSL.name("projectId"), SQLDataType.VARCHAR(54).nullable(false), this, "");

    /**
     * The column <code>idea_tags.postId</code>.
     */
    public final TableField<JooqIdeaTagsRecord, String> POSTID = createField(DSL.name("postId"), SQLDataType.VARCHAR(54).nullable(false), this, "");

    /**
     * The column <code>idea_tags.tagId</code>.
     */
    public final TableField<JooqIdeaTagsRecord, String> TAGID = createField(DSL.name("tagId"), SQLDataType.VARCHAR(54).nullable(false), this, "");

    private JooqIdeaTags(Name alias, Table<JooqIdeaTagsRecord> aliased) {
        this(alias, aliased, null);
    }

    private JooqIdeaTags(Name alias, Table<JooqIdeaTagsRecord> aliased, Field<?>[] parameters) {
        super(alias, null, aliased, parameters, DSL.comment(""), TableOptions.table());
    }

    /**
     * Create an aliased <code>idea_tags</code> table reference
     */
    public JooqIdeaTags(String alias) {
        this(DSL.name(alias), IDEA_TAGS);
    }

    /**
     * Create an aliased <code>idea_tags</code> table reference
     */
    public JooqIdeaTags(Name alias) {
        this(alias, IDEA_TAGS);
    }

    /**
     * Create a <code>idea_tags</code> table reference
     */
    public JooqIdeaTags() {
        this(DSL.name("idea_tags"), null);
    }

    public <O extends Record> JooqIdeaTags(Table<O> child, ForeignKey<O, JooqIdeaTagsRecord> key) {
        super(child, key, IDEA_TAGS);
    }

    @Override
    public Schema getSchema() {
        return aliased() ? null : DefaultSchema.DEFAULT_SCHEMA;
    }

    @Override
    public UniqueKey<JooqIdeaTagsRecord> getPrimaryKey() {
        return JooqKeys.KEY_IDEA_TAGS_PRIMARY;
    }

    @Override
    public List<ForeignKey<JooqIdeaTagsRecord, ?>> getReferences() {
        return Arrays.asList(JooqKeys.IDEA_TAGS_IBFK_1);
    }

    private transient JooqIdea _idea;

    /**
     * Get the implicit join path to the <code>clearflask.idea</code> table.
     */
    public JooqIdea idea() {
        if (_idea == null)
            _idea = new JooqIdea(this, JooqKeys.IDEA_TAGS_IBFK_1);

        return _idea;
    }

    @Override
    public JooqIdeaTags as(String alias) {
        return new JooqIdeaTags(DSL.name(alias), this);
    }

    @Override
    public JooqIdeaTags as(Name alias) {
        return new JooqIdeaTags(alias, this);
    }

    /**
     * Rename this table
     */
    @Override
    public JooqIdeaTags rename(String name) {
        return new JooqIdeaTags(DSL.name(name), null);
    }

    /**
     * Rename this table
     */
    @Override
    public JooqIdeaTags rename(Name name) {
        return new JooqIdeaTags(name, null);
    }

    // -------------------------------------------------------------------------
    // Row3 type methods
    // -------------------------------------------------------------------------

    @Override
    public Row3<String, String, String> fieldsRow() {
        return (Row3) super.fieldsRow();
    }
}
