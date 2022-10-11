/*
 * This file is generated by jOOQ.
 */
package com.smotana.clearflask.store.mysql.model.tables;


import com.smotana.clearflask.store.mysql.LocalDateTimeToInstantBinding;
import com.smotana.clearflask.store.mysql.model.DefaultSchema;
import com.smotana.clearflask.store.mysql.model.JooqIndexes;
import com.smotana.clearflask.store.mysql.model.JooqKeys;
import com.smotana.clearflask.store.mysql.model.tables.records.JooqCommentRecord;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;

import javax.annotation.processing.Generated;

import org.jooq.Field;
import org.jooq.ForeignKey;
import org.jooq.Index;
import org.jooq.Name;
import org.jooq.Record;
import org.jooq.Row15;
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
public class JooqComment extends TableImpl<JooqCommentRecord> {

    private static final long serialVersionUID = 1L;

    /**
     * The reference instance of <code>comment</code>
     */
    public static final JooqComment COMMENT = new JooqComment();

    /**
     * The class holding records for this type
     */
    @Override
    public Class<JooqCommentRecord> getRecordType() {
        return JooqCommentRecord.class;
    }

    /**
     * The column <code>comment.projectId</code>.
     */
    public final TableField<JooqCommentRecord, String> PROJECTID = createField(DSL.name("projectId"), SQLDataType.VARCHAR(255).nullable(false), this, "");

    /**
     * The column <code>comment.postId</code>.
     */
    public final TableField<JooqCommentRecord, String> POSTID = createField(DSL.name("postId"), SQLDataType.VARCHAR(255).nullable(false), this, "");

    /**
     * The column <code>comment.commentId</code>.
     */
    public final TableField<JooqCommentRecord, String> COMMENTID = createField(DSL.name("commentId"), SQLDataType.VARCHAR(255).nullable(false), this, "");

    /**
     * The column <code>comment.parentCommentIds</code>.
     */
    public final TableField<JooqCommentRecord, String> PARENTCOMMENTIDS = createField(DSL.name("parentCommentIds"), SQLDataType.VARCHAR(10000).nullable(false), this, "");

    /**
     * The column <code>comment.level</code>.
     */
    public final TableField<JooqCommentRecord, Long> LEVEL = createField(DSL.name("level"), SQLDataType.BIGINT.nullable(false), this, "");

    /**
     * The column <code>comment.childCommentCount</code>.
     */
    public final TableField<JooqCommentRecord, Long> CHILDCOMMENTCOUNT = createField(DSL.name("childCommentCount"), SQLDataType.BIGINT.nullable(false), this, "");

    /**
     * The column <code>comment.authorUserId</code>.
     */
    public final TableField<JooqCommentRecord, String> AUTHORUSERID = createField(DSL.name("authorUserId"), SQLDataType.VARCHAR(255), this, "");

    /**
     * The column <code>comment.authorName</code>.
     */
    public final TableField<JooqCommentRecord, String> AUTHORNAME = createField(DSL.name("authorName"), SQLDataType.VARCHAR(255), this, "");

    /**
     * The column <code>comment.authorIsMod</code>.
     */
    public final TableField<JooqCommentRecord, Boolean> AUTHORISMOD = createField(DSL.name("authorIsMod"), SQLDataType.BOOLEAN, this, "");

    /**
     * The column <code>comment.created</code>.
     */
    public final TableField<JooqCommentRecord, Instant> CREATED = createField(DSL.name("created"), SQLDataType.LOCALDATETIME(6).nullable(false), this, "", new LocalDateTimeToInstantBinding());

    /**
     * The column <code>comment.edited</code>.
     */
    public final TableField<JooqCommentRecord, Instant> EDITED = createField(DSL.name("edited"), SQLDataType.LOCALDATETIME(6), this, "", new LocalDateTimeToInstantBinding());

    /**
     * The column <code>comment.content</code>.
     */
    public final TableField<JooqCommentRecord, String> CONTENT = createField(DSL.name("content"), SQLDataType.VARCHAR(10000), this, "");

    /**
     * The column <code>comment.upvotes</code>.
     */
    public final TableField<JooqCommentRecord, Long> UPVOTES = createField(DSL.name("upvotes"), SQLDataType.BIGINT.nullable(false), this, "");

    /**
     * The column <code>comment.downvotes</code>.
     */
    public final TableField<JooqCommentRecord, Long> DOWNVOTES = createField(DSL.name("downvotes"), SQLDataType.BIGINT.nullable(false), this, "");

    /**
     * The column <code>comment.score</code>.
     */
    public final TableField<JooqCommentRecord, Double> SCORE = createField(DSL.name("score"), SQLDataType.DOUBLE.nullable(false), this, "");

    private JooqComment(Name alias, Table<JooqCommentRecord> aliased) {
        this(alias, aliased, null);
    }

    private JooqComment(Name alias, Table<JooqCommentRecord> aliased, Field<?>[] parameters) {
        super(alias, null, aliased, parameters, DSL.comment(""), TableOptions.table());
    }

    /**
     * Create an aliased <code>comment</code> table reference
     */
    public JooqComment(String alias) {
        this(DSL.name(alias), COMMENT);
    }

    /**
     * Create an aliased <code>comment</code> table reference
     */
    public JooqComment(Name alias) {
        this(alias, COMMENT);
    }

    /**
     * Create a <code>comment</code> table reference
     */
    public JooqComment() {
        this(DSL.name("comment"), null);
    }

    public <O extends Record> JooqComment(Table<O> child, ForeignKey<O, JooqCommentRecord> key) {
        super(child, key, COMMENT);
    }

    @Override
    public Schema getSchema() {
        return aliased() ? null : DefaultSchema.DEFAULT_SCHEMA;
    }

    @Override
    public List<Index> getIndexes() {
        return Arrays.asList(JooqIndexes.COMMENT_COMMENT_AUTHORUSERID_IDX, JooqIndexes.COMMENT_COMMENT_PROJECTID_IDX, JooqIndexes.COMMENT_COMMENT_PROJECTID_POSTID_IDX);
    }

    @Override
    public UniqueKey<JooqCommentRecord> getPrimaryKey() {
        return JooqKeys.KEY_COMMENT_PRIMARY;
    }

    @Override
    public JooqComment as(String alias) {
        return new JooqComment(DSL.name(alias), this);
    }

    @Override
    public JooqComment as(Name alias) {
        return new JooqComment(alias, this);
    }

    /**
     * Rename this table
     */
    @Override
    public JooqComment rename(String name) {
        return new JooqComment(DSL.name(name), null);
    }

    /**
     * Rename this table
     */
    @Override
    public JooqComment rename(Name name) {
        return new JooqComment(name, null);
    }

    // -------------------------------------------------------------------------
    // Row15 type methods
    // -------------------------------------------------------------------------

    @Override
    public Row15<String, String, String, String, Long, Long, String, String, Boolean, Instant, Instant, String, Long, Long, Double> fieldsRow() {
        return (Row15) super.fieldsRow();
    }
}
