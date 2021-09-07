// SPDX-FileCopyrightText: 2019-2020 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
package com.smotana.clearflask.web.security;

public class Role {
    /**
     * Applies to me
     */
    public static final String SUPER_ADMIN = "SUPER_ADMIN";
    /**
     * Applies to NodeJS server on localhost
     */
    public static final String CONNECT = "CONNECT";
    /**
     * Applies to any ClearFlask customer; NOT ClearFlask administrator AND
     * account is in good active standing.
     */
    public static final String ADMINISTRATOR_ACTIVE = "ADMINISTRATOR_ACTIVE";
    /**
     * Applies to any ClearFlask customer; NOT ClearFlask administrator AND
     * account may or may not be in good standing.
     */
    public static final String ADMINISTRATOR = "ADMINISTRATOR";

    /**
     * Applies to entity that is anonymous but accessing a project resource.
     * If the project has private visibility, access will not be allowed
     * unless the user is logged in.
     */
    public static final String PROJECT_ANON = "PROJECT_ANON";
    /**
     * Applies to entity that is registered to the project specified in path parameter
     * and has moderator privileges.
     */
    public static final String PROJECT_MODERATOR = "PROJECT_MODERATOR";
    /**
     * Applies to entity that is registered to the project specified in path parameter
     * and has moderator privileges and the account is active.
     */
    public static final String PROJECT_MODERATOR_ACTIVE = "PROJECT_MODERATOR_ACTIVE";
    /**
     * Applies to entity that is registered to the project specified in path parameter
     */
    public static final String PROJECT_USER = "PROJECT_USER";
    /**
     * Applies to entity that owns the project specified in path parameter AND
     * account is in good active standing.
     */
    public static final String PROJECT_ADMIN_ACTIVE = "PROJECT_ADMIN_ACTIVE";
    /**
     * Applies to entity that is an admin of the project specified in path parameter AND
     * account may or may not be in good standing.
     */
    public static final String PROJECT_ADMIN = "PROJECT_ADMIN";
    /**
     * Applies to entity that is an admin of the project specified in path parameter AND
     * account is in good active standing.
     */
    public static final String PROJECT_OWNER_ACTIVE = "PROJECT_OWNER_ACTIVE";
    /**
     * Applies to entity that owns the project specified in path parameter AND
     * account may or may not be in good standing.
     */
    public static final String PROJECT_OWNER = "PROJECT_OWNER";

    /**
     * Applies to entity that owns the idea specified in path parameter
     */
    public static final String IDEA_OWNER = "IDEA_OWNER";

    /**
     * Applies to entity that owns the comment specified in path parameter
     */
    public static final String COMMENT_OWNER = "COMMENT_OWNER";
}
