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
export const createClassNameGenerator = (seed?: string) => createGenerateClassName({
  // Disable global class name obfuscation - keeps names like 'MuiButton-root'
  disableGlobal: false,
  // Use 'cf' (ClearFlask) prefix for makeStyles/withStyles generated classes
  // This makes classes like 'cf-ComponentName-ruleName-123' instead of 'jss123'
  productionPrefix: 'cf',
  // Seed to avoid collisions between different StylesProvider instances
  seed: seed || '',
});

/**
 * Shared class name generator instance for the main application.
 * Using a single instance ensures consistent class naming across components.
 */
export const generateClassName = createClassNameGenerator();
