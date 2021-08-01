// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Modified from https://github.com/Etoile984816138/quill-image-resize-module/blob/master/src/modules/Toolbar.js
 * 
 * - Changed icons
 * - Custom css
 */

import Quill from "quill";

var BaseImageFormat = Quill.import('formats/image');
const ImageFormatAttributesList = [
  'width',
  'align',
];
class ImageFormat extends BaseImageFormat {
  static formats(domNode) {
    return ImageFormatAttributesList.reduce(function (formats, attribute) {
      if (domNode.hasAttribute(attribute)) {
        formats[attribute] = domNode.getAttribute(attribute);
      }
      return formats;
    }, {});
  }
  format(name, value) {
    if (ImageFormatAttributesList.indexOf(name) > -1) {
      if (value) {
        this.domNode.setAttribute(name, value);
      } else {
        this.domNode.removeAttribute(name);
      }
    } else {
      super.format(name, value);
    }
  }
}
Quill.register(ImageFormat, true);


// '@material-ui/icons/FormatAlignCenter';
const AlignCenterIcon = `<svg width="24" height="24" viewBox="0 0 24 24"><path d="M7 15v2h10v-2H7zm-4 6h18v-2H3v2zm0-8h18v-2H3v2zm4-6v2h10V7H7zM3 3v2h18V3H3z" /></svg>`
// '@material-ui/icons/FormatAlignLeft';
const AlignLeftIcon = `<svg width="24" height="24" viewBox="0 0 24 24"><path d="M15 15H3v2h12v-2zm0-8H3v2h12V7zM3 13h18v-2H3v2zm0 8h18v-2H3v2zM3 3v2h18V3H3z" /></svg>`
// '@material-ui/icons/FormatAlignRight';
const AlignRightIcon = `<svg width="24" height="24" viewBox="0 0 24 24"><path d="M3 21h18v-2H3v2zm6-4h12v-2H9v2zm-6-4h18v-2H3v2zm6-4h12V7H9v2zM3 3v2h18V3H3z" /></svg>`

const Parchment = Quill.import('parchment');
const AlignAttr = new Parchment.Attributor.Attribute('align', 'align', { scope: Parchment.Scope.INLINE });
Quill.register(AlignAttr);

export default class ToolbarExtended {
  overlay;
  img;
  options;
  requestUpdate;
  toolbar;
  alignments;

  constructor(resizer) {
    this.overlay = resizer.overlay;
    this.img = resizer.img;
    this.options = resizer.options;
    this.requestUpdate = resizer.onUpdate;
  }

  onCreate = () => {
    // Setup Toolbar
    this.toolbar = document.createElement('div');
    Object.assign(this.toolbar.style, {
      display: 'flex',
      position: 'absolute',
      left: '50%',
      transform: 'translateX(-50%)',
    });
    this.overlay.appendChild(this.toolbar);

    // Setup Buttons
    this._defineAlignments();
    this._addToolbarButtons();
  };

  // The toolbar and its children will be destroyed when the overlay is removed
  onDestroy = () => { };

  // Nothing to update on drag because we are are positioned relative to the overlay
  onUpdate = () => { };

  _defineAlignments = () => {
    this.alignments = [
      {
        icon: AlignLeftIcon,
        apply: () => {
          this.img.align = 'left';
        },
        isApplied: () => this.img.align === 'left',
      },
      {
        icon: AlignCenterIcon,
        apply: () => {
          this.img.align = 'middle';
        },
        isApplied: () => this.img.align === 'middle',
      },
      {
        icon: AlignRightIcon,
        apply: () => {
          this.img.align = 'right';
        },
        isApplied: () => this.img.align === 'right',
      },
    ];
  };

  _addToolbarButtons = () => {
    const buttons: HTMLSpanElement[] = [];
    this.alignments.forEach((alignment, idx) => {
      const button = document.createElement('span');
      buttons.push(button);
      button.innerHTML = alignment.icon;
      button.addEventListener('click', () => {
        if (alignment.isApplied()) {
          // If applied, unapply
          this.img.align = undefined;
        } else {
          // otherwise, select button and apply
          alignment.apply();
        }
        // image may change position; redraw drag handles
        this.requestUpdate();
      });
      Object.assign(button.style, {
        cursor: 'pointer',
      });
      if (idx > 0) {
        button.style.borderLeftWidth = '0';
      }
      this.toolbar.appendChild(button);
    });
  };
}
