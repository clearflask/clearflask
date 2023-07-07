// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import * as Admin from '../../api/admin';
import windowIso from '../windowIso';
import { escapeHtml } from './htmlUtil';

export function getProjectName(config?: Admin.ConfigAdmin): string {
  // If changed, also change in ProjectUtil.java
  return config?.name
    || config?.slug
    || config?.domain
    || config?.projectId
    || 'Unnamed';
}

export const getProjectLink = (config: Pick<Admin.Config, 'domain' | 'slug'>): string => {
  return `${windowIso.location.protocol}//${escapeHtml(config.domain) || `${escapeHtml(config.slug)}.${windowIso.location.host}`}`
}
