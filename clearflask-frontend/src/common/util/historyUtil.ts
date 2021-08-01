// SPDX-FileCopyrightText: 2019-2020 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { Location } from 'history';

export function preserveEmbed(path: string, location: Location): string {
  if (!location.pathname.match(/^\/?embed/)) {
    return path;
  }
  return path.replace(/^(\/?embed)?/, '/embed');
}