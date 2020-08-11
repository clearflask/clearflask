package com.smotana.clearflask.web.security;

public class Role {
    /**
     * Applies to me
     */
    public static final String MATUS = "MATUS";
    /**
     * Applies to any ClearFlask customer; NOT ClearFlask administrator AND
     * account is in good active standing.
     */
    public static final String ADMINISTRATOR_ACTIVE = "ADMINISTRATOR";
    /**
     * Applies to any ClearFlask customer; NOT ClearFlask administrator AND
     * account may or may not be in good standing.
     */
    public static final String ADMINISTRATOR = "ADMINISTRATOR_LIMITED";
    /**
     * Applies to any registered user
     */
    public static final String USER = "USER";

    /**
     * Applies to entity that is anonymous but accessing a project resource.
     * If the project has private visibility, access will not be allowed.
     * Should typically be combined with PROJECT_USER role.
     */
    public static final String PROJECT_ANON = "PROJECT_ANON";
    /**
     * Applies to entity that is registered to the project specified in path parameter
     */
    public static final String PROJECT_USER = "PROJECT_USER";
    /**
     * Applies to entity that owns the project specified in path parameter AND
     * account is in good active standing.
     */
    public static final String PROJECT_OWNER_ACTIVE = "PROJECT_OWNER";
    /**
     * Applies to entity that owns the project specified in path parameter AND
     * account may or may not be in good standing.
     */
    public static final String PROJECT_OWNER = "PROJECT_OWNER_LIMITED";

    /**
     * Applies to entity that owns the idea specified in path parameter
     */
    public static final String IDEA_OWNER = "IDEA_OWNER";

    /**
     * Applies to entity that owns the comment specified in path parameter
     */
    public static final String COMMENT_OWNER = "COMMENT_OWNER";
}
