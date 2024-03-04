/*
 * This file is generated by jOOQ.
 */
package com.smotana.clearflask.store.mysql.model;


import com.smotana.clearflask.store.mysql.model.tables.*;
import org.jooq.Catalog;
import org.jooq.Table;
import org.jooq.impl.SchemaImpl;

import javax.annotation.processing.Generated;
import java.util.Arrays;
import java.util.List;


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
@SuppressWarnings({"all", "unchecked", "rawtypes"})
public class DefaultSchema extends SchemaImpl {

    private static final long serialVersionUID = 1L;

    /**
     * The reference instance of <code>DEFAULT_SCHEMA</code>
     */
    public static final DefaultSchema DEFAULT_SCHEMA = new DefaultSchema();

    /**
     * The table <code>account</code>.
     */
    public final JooqAccount ACCOUNT = JooqAccount.ACCOUNT;

    /**
     * The table <code>comment</code>.
     */
    public final JooqComment COMMENT = JooqComment.COMMENT;

    /**
     * The table <code>comment_parent_id</code>.
     */
    public final JooqCommentParentId COMMENT_PARENT_ID = JooqCommentParentId.COMMENT_PARENT_ID;

    /**
     * The table <code>idea</code>.
     */
    public final JooqIdea IDEA = JooqIdea.IDEA;

    /**
     * The table <code>idea_funders</code>.
     */
    public final JooqIdeaFunders IDEA_FUNDERS = JooqIdeaFunders.IDEA_FUNDERS;

    /**
     * The table <code>idea_tags</code>.
     */
    public final JooqIdeaTags IDEA_TAGS = JooqIdeaTags.IDEA_TAGS;

    /**
     * The table <code>user</code>.
     */
    public final JooqUser USER = JooqUser.USER;

    /**
     * No further instances allowed
     */
    private DefaultSchema() {
        super("", null);
    }


    @Override
    public Catalog getCatalog() {
        return DefaultCatalog.DEFAULT_CATALOG;
    }

    @Override
    public final List<Table<?>> getTables() {
        return Arrays.asList(
                JooqAccount.ACCOUNT,
                JooqComment.COMMENT,
                JooqCommentParentId.COMMENT_PARENT_ID,
                JooqIdea.IDEA,
                JooqIdeaFunders.IDEA_FUNDERS,
                JooqIdeaTags.IDEA_TAGS,
                JooqUser.USER
        );
    }
}
