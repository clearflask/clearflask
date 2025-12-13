// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package org.kohsuke.github;

/**
 * For event types that are not yet supported, we need to parse just the basic event. Since {@link GHEventPayload} is
 * now an abstract class, this concrete class makes it more concrete so it can be instantiated when JSON deserializing.
 */
public class GHBaseEvent extends GHEventPayload {
}
