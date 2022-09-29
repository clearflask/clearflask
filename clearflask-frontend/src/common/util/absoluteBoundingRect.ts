// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
/**
 * From https://gist.githubusercontent.com/rgrove/5463265/raw/6d4e39342ce6d583b0b56e35388b46d9c34df909/getAbsoluteBoundingRect.js
 * 
 * MIT License
 * 
 * Copyright (c) 2013 Ryan Grove <ryan@wonko.com>.
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
 * FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 * IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
/**
Returns a bounding rect for _el_ with absolute coordinates corrected for
scroll positions.

The native `getBoundingClientRect()` returns coordinates for an element's
visual position relative to the top left of the viewport, so if the element
is part of a scrollable region that has been scrolled, its coordinates will
be different than if the region hadn't been scrolled.

This method corrects for scroll offsets all the way up the node tree, so the
returned bounding rect will represent an absolute position on a virtual
canvas, regardless of scrolling.

@method getAbsoluteBoundingRect
@param {HTMLElement} el HTML element.
@return {Object} Absolute bounding rect for _el_.
**/

export default function getAbsoluteBoundingRect(el) {
  var doc = document,
    win = window,
    body = doc.body,

    // pageXOffset and pageYOffset work everywhere except IE <9.
    offsetX = win.pageXOffset !== undefined ? win.pageXOffset :
      (doc.documentElement || body.parentNode || body).scrollLeft,
    offsetY = win.pageYOffset !== undefined ? win.pageYOffset :
      (doc.documentElement || body.parentNode || body).scrollTop,

    rect = el.getBoundingClientRect();

  if (el !== body) {
    var parent = el.parentNode;

    // The element's rect will be affected by the scroll positions of
    // *all* of its scrollable parents, not just the window, so we have
    // to walk up the tree and collect every scroll offset. Good times.
    while (parent !== body) {
      offsetX += parent.scrollLeft;
      offsetY += parent.scrollTop;
      parent = parent.parentNode;
    }
  }

  return {
    bottom: rect.bottom + offsetY,
    height: rect.height,
    left: rect.left + offsetX,
    right: rect.right + offsetX,
    top: rect.top + offsetY,
    width: rect.width
  };
}