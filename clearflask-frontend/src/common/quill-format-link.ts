// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
/**
 * Modified from https://github.com/quilljs/quill/blob/develop/formats/link.js
 * 
 * - Added support for custom rel
 * - Add protocol prefix if missing
 * 
 * Copyright (c) 2017, Slab
 * Copyright (c) 2014, Jason Chen
 * Copyright (c) 2013, salesforce.com
 * All rights reserved.
 * 
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 * 
 * 1. Redistributions of source code must retain the above copyright
 * notice, this list of conditions and the following disclaimer.
 * 
 * 2. Redistributions in binary form must reproduce the above copyright
 * notice, this list of conditions and the following disclaimer in the
 * documentation and/or other materials provided with the distribution.
 * 
 * 3. Neither the name of the copyright holder nor the names of its
 * contributors may be used to endorse or promote products derived from
 * this software without specific prior written permission.
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS
 * IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED
 * TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A
 * PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
import Quill from 'quill';
let Inline = Quill.import('blots/inline');

export default class QuillFormatLinkExtended extends Inline {
  static create(value) {
    const node = super.create(value);
    node.setAttribute('href', sanitize(value));
    // If changed, also change in Sanitizer.java
    node.setAttribute('rel', 'noreferrer noopener ugc');
    // If changed, also change in Sanitizer.java
    node.setAttribute('target', '_blank');
    return node;
  }

  static formats(domNode) {
    return domNode.getAttribute('href');
  }

  format(name, value) {
    if (name !== this['statics'].blotName || !value) {
      super.format(name, value);
    } else {
      this['domNode'].setAttribute('href', sanitize(value));
    }
  }
}
QuillFormatLinkExtended['blotName'] = 'link';
QuillFormatLinkExtended['tagName'] = 'A';
/** If changed, also change in Sanitizer.java */
const PROTOCOL_WHITELIST = ['http', 'https', 'mailto', 'tel'];

export function sanitize(url) {
  if (url.indexOf(":") === -1) {
    url = "https://" + url;
  }
  const anchor = document.createElement('a');
  anchor.href = url;
  const protocol = anchor.href.slice(0, anchor.href.indexOf(':'));
  if (PROTOCOL_WHITELIST.indexOf(protocol) === -1) {
    return '';
  }
  return url;
}
