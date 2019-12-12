package com.smotana.clearflask.web.security;

public class Role {
    /** Applies to any ClearFlask customer; NOT ClearFlask administrator */
    public static final String ADMINISTRATOR = "ADMINISTRATOR";
    /** Applies to any registered user */
    public static final String USER = "USER";

    /** Applies to entity that is registered to the project specified in path parameter */
    public static final String PROJECT_USER = "PROJECT_USER";
    /** Applies to entity that owns the project specified in path parameter */
    public static final String PROJECT_OWNER = "PROJECT_OWNER";
    /** Applies to Client on the Basic plan */
    public static final String PROJECT_OWNER_PLAN_BASIC = "PLAN_BASIC";
    /** Applies to Client on the Analytic plan */
    public static final String PROJECT_OWNER_PLAN_ANALYTIC = "PLAN_ANALYTIC";
    /** Applies to Client on the Enterprise plan */
    public static final String PROJECT_OWNER_PLAN_ENTERPRISE = "PLAN_ENTERPRISE";

    /** Applies to entity that owns the idea specified in path parameter */
    public static final String IDEA_OWNER = "IDEA_OWNER";

    /** Applies to entity that owns the comment specified in path parameter */
    public static final String COMMENT_OWNER = "COMMENT_OWNER";
}
