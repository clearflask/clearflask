// SPDX-FileCopyrightText: 2019-2020 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import windowIso from '../windowIso';

export function preserveEmbed(path: string): string {
  if (!windowIso.location.pathname.match(/^\/?embed/)) {
    return path;
  }
  return path.replace(/^(\/?embed)?/, '/embed');
}
