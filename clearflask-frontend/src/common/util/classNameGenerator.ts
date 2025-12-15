// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0

/**
 * Creates a custom class name generator that preserves readable CSS class names.
 *
 * By default, MUI/JSS obfuscates class names in production (e.g., 'jss1', 'jss2').
 * This generator produces semantic class names (e.g., 'MuiButton-root', 'makeStyles-header-1')
 * in ALL environments (production and development) so customers can target them in their custom CSS.
 *
 * @param seed Optional seed to avoid class name collisions when multiple style providers exist
 */

// List of pseudo-class names from Material-UI that get special treatment
const pseudoClasses = [
  'checked', 'disabled', 'error', 'focused', 'focusVisible',
  'required', 'expanded', 'selected'
];

export const createClassNameGenerator = (seed?: string) => {
  const seedPrefix = seed ? `${seed}-` : '';
  let ruleCounter = 0;

  const getNextCounterId = () => {
    ruleCounter += 1;
    return ruleCounter;
  };

  // Custom generator that ALWAYS produces descriptive class names
  // This mimics Material-UI's development mode behavior but works in production too
  return (rule: any, styleSheet: any) => {
    const name = styleSheet?.options?.name;

    // Handle Material-UI component classes (e.g., MuiButton-root)
    if (name && name.indexOf('Mui') === 0 && !styleSheet.options.link) {
      // Pseudo-classes get special short names (e.g., Mui-focused)
      if (pseudoClasses.indexOf(rule.key) !== -1) {
        return `Mui-${rule.key}`;
      }

      // Regular MUI component classes (e.g., MuiButton-root, MuiButton-contained)
      return `${seedPrefix}${name}-${rule.key}`;
    }

    // For custom styles (makeStyles/withStyles), generate descriptive names
    // Format: prefix-ruleName-counter (e.g., "makeStyles-header-1")
    const suffix = `${rule.key}-${getNextCounterId()}`;

    if (styleSheet?.options?.classNamePrefix) {
      // If a class name prefix is set (from makeStyles), use it
      // e.g., "LandingPage-hero-1"
      return `${seedPrefix}${styleSheet.options.classNamePrefix}-${suffix}`;
    }

    // Fallback for styles without a prefix
    // e.g., "container-1", "button-2"
    return `${seedPrefix}${suffix}`;
  };
};

/**
 * Shared class name generator instance for the main application.
 * Using a single instance ensures consistent class naming across components.
 */
export const generateClassName = createClassNameGenerator();
