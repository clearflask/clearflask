// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import windowIso from '../windowIso';

export function preserveEmbed(path: string): string {
  if (!windowIso.location.pathname.match(/^\/?embed/)) {
    return path;
  }
  return path.replace(/^(\/?embed)?/, '/embed');
}
