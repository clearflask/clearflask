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
  // Material-UI's createGenerateClassName with custom prefix
  // In production: uses productionPrefix
  // In development: still uses 'jss' prefix by default, but we force 'cf' below
  const muiGenerator = createGenerateClassName({
    disableGlobal: false,  // Keep MuiButton-root style names
    productionPrefix: 'cf',  // Use 'cf' prefix in production
    seed: seed || '',
  });

  // Track if we're in production mode (webpack sets NODE_ENV=production)
  const isProduction = process.env.NODE_ENV === 'production';

  // In production, MUI already uses our prefix, so just return the generator
  if (isProduction) {
    return muiGenerator;
  }

  // In development, wrap the generator to replace 'jss' with 'cf'
  // This ensures consistent class names across all environments
  return (rule: any, styleSheet: any) => {
    const className = muiGenerator(rule, styleSheet);
    // Only replace the prefix, keep the counter (jss123 -> cf123)
    return className.replace(/^jss/, 'cf');
  };
};

/**
 * Shared class name generator instance for the main application.
 * Using a single instance ensures consistent class naming across components.
 */
export const generateClassName = createClassNameGenerator();
