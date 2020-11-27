/**
 * Modified from https://github.com/quilljs/quill/blob/develop/formats/link.js
 * 
 * - Added support for custom rel
 * - Add protocol prefix if missing
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
    if (name !== this.statics.blotName || !value) {
      super.format(name, value);
    } else {
      this.domNode.setAttribute('href', sanitize(value));
    }
  }
}
QuillFormatLinkExtended.blotName = 'link';
QuillFormatLinkExtended.tagName = 'A';
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
