// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0

package com.smotana.clearflask.security.limiter;

import javax.ws.rs.NameBinding;
import java.lang.annotation.Retention;
import java.lang.annotation.Target;

import static java.lang.annotation.ElementType.METHOD;
import static java.lang.annotation.ElementType.TYPE;
import static java.lang.annotation.RetentionPolicy.RUNTIME;

/**
 * Specifies the list of roles permitted to access method(s) in an application.
 * The value of the RolesAllowed annotation is a list of security role names.
 * This annotation can be specified on a class or on method(s). Specifying it
 * at a class level means that it applies to all the methods in the class.
 * Specifying it on a method means that it is applicable to that method only.
 * If applied at both the class and methods level , the method value overrides
 * the class value if the two conflict.
 *
 * @since Common Annotations 1.0
 */
@NameBinding
@Retention(RUNTIME)
@Target({TYPE, METHOD})
@Limit(requiredPermits = 2)
public @interface Limit {
    /**
     * Amount of permits required to perform this action assuming
     * you have a single permit per second to spend.
     * Permits are shared across resources.
     */
    int requiredPermits() default -1;

    /**
     * Amount of challenge-free attempts to allow.
     * Attempts are independent between resources.
     * Will be reset after a configured period of inactivity.
     */
    int challengeAfter() default -1;
}
