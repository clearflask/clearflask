// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { createGenerateClassName } from '@material-ui/core/styles';

/**
 * Creates a custom class name generator that preserves readable CSS class names.
 *
 * By default, MUI/JSS obfuscates class names in production (e.g., 'jss1', 'jss2').
 * This configuration preserves semantic class names (e.g., 'MuiButton-root', 'makeStyles-header-1')
 * so customers can target them in their custom CSS.
 *
 * @param seed Optional seed to avoid class name collisions when multiple style providers exist
 */
export const createClassNameGenerator = (seed?: string) => {
  // Material-UI's createGenerateClassName - we'll wrap it to force 'cf' prefix
  const muiGenerator = createGenerateClassName({
    disableGlobal: false,  // Keep MuiButton-root style names
    productionPrefix: 'cf',  // Attempt to use 'cf' prefix (only works when NODE_ENV=production at build time)
    seed: seed || '',
  });

  // Always wrap the generator to ensure 'cf' prefix in ALL environments
  // This is necessary because:
  // 1. SSR server may not have NODE_ENV=production set
  // 2. Development builds need consistent class names
  // 3. We want predictable class names for customer CSS targeting
  return (rule: any, styleSheet: any) => {
    const className = muiGenerator(rule, styleSheet);
    // Replace 'jss' prefix with 'cf', keeping everything else the same
    // Examples: jss123 -> cf123, jss1 -> cf1
    return className.replace(/^jss/, 'cf');
  };
};

/**
 * Shared class name generator instance for the main application.
 * Using a single instance ensures consistent class naming across components.
 */
export const generateClassName = createClassNameGenerator();
