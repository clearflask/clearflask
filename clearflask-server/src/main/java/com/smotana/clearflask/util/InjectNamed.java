package com.smotana.clearflask.util;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * DO NOT OPEN SOURCE
 *
 * Specifies that a given field is a dynamically injected property based on Named name.
 *
 * See NamedProviderBinding javadoc for more details.
 */
@Target(value = {ElementType.FIELD})
@Retention(value = RetentionPolicy.RUNTIME)
@Documented
public @interface InjectNamed {
}
