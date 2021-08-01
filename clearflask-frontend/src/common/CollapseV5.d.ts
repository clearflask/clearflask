// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Imported from MuiV5 since MuiV4 only has vertical Collapse.
 * Once we migrate, this can be deleted unless new functionality has been added.
 *
 * https://github.com/mui-org/material-ui/blob/a0cccf538eab4ea50b0601e7296ac583f16004f9/packages/material-ui/src/Collapse/Collapse.js
 *
 *
 */
/**
 * The MIT License (MIT)
 *
 * Copyright (c) 2014 Call-Em-All
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import { StandardProps } from '@material-ui/core';
import { TransitionProps } from '@material-ui/core/transitions';
import * as React from 'react';

export interface CollapseV5Props extends StandardProps<TransitionProps, 'timeout'> {
  /**
   * The content node to be collapsed.
   */
  children?: React.ReactNode;
  className?: string;
  /**
   * Override or extend the styles applied to the component.
   */
  classes?: Partial<{
    /** Styles applied to the root element. */
    root: string;
    /** Pseudo-class applied to the root element if `orientation="horizontal"`. */
    horizontal: string;
    /** Styles applied to the root element when the transition has entered. */
    entered: string;
    /** Styles applied to the root element when the transition has exited and `collapsedSize` = 0px. */
    hidden: string;
    /** Styles applied to the outer wrapper element. */
    wrapper: string;
    /** Styles applied to the inner wrapper element. */
    wrapperInner: string;
  }> | any;
  /**
   * The width (horizontal) or height (vertical) of the container when collapsed.
   * @default '0px'
   */
  collapsedSize?: string | number;
  /**
   * The component used for the root node.
   * Either a string to use a HTML element or a component.
   */
  component?: React.ElementType<TransitionProps>;
  /**
   * The transition timing function.
   * You may specify a single easing or a object containing enter and exit values.
   */
  easing?: any;
  /**
   * If `true`, the component will transition in.
   */
  in?: boolean;
  /**
   * The transition orientation.
   * @default 'vertical'
   */
  orientation?: 'horizontal' | 'vertical';
  /**
   * The duration for the transition, in milliseconds.
   * You may specify a single timeout for all transitions, or individually with an object.
   *
   * Set to 'auto' to automatically calculate transition time based on height.
   * @default duration.standard
   */
  timeout?: any | 'auto';
  /**
   * The system prop that allows defining system overrides as well as additional CSS styles.
   */
  sx?: any;
}

/**
 * The Collapse transition is used by the
 * [Vertical Stepper](https://material-ui.com/components/steppers/#vertical-stepper) StepContent component.
 * It uses [react-transition-group](https://github.com/reactjs/react-transition-group) internally.
 *
 * Demos:
 *
 * - [Cards](https://material-ui.com/components/cards/)
 * - [Lists](https://material-ui.com/components/lists/)
 * - [Transitions](https://material-ui.com/components/transitions/)
 *
 * API:
 *
 * - [Collapse API](https://material-ui.com/api/collapse/)
 * - inherits [Transition API](https://reactcommunity.org/react-transition-group/transition#Transition-props)
 */

export default function CollapseV5(props: CollapseV5Props): JSX.Element;
