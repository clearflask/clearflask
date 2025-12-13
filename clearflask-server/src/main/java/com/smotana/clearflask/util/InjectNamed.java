// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.util;

import java.lang.annotation.*;

/**
 * Specifies that a given field is a dynamically injected property based on Named name.
 * <p>
 * See NamedProviderBinding javadoc for more details.
 */
@Target(value = {ElementType.FIELD})
@Retention(value = RetentionPolicy.RUNTIME)
@Documented
public @interface InjectNamed {
}
