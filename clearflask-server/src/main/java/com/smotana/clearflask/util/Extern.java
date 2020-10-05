package com.smotana.clearflask.util;

import java.lang.annotation.Retention;
import java.lang.annotation.Target;

import static java.lang.annotation.ElementType.METHOD;
import static java.lang.annotation.RetentionPolicy.RUNTIME;

/**
 * Expose a method via JMX beans.
 */
@Retention(RUNTIME)
@Target(METHOD)
public @interface Extern {
}
