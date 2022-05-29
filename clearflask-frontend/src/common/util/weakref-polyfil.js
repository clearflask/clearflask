// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0

// https://github.com/ungap/weakrefs/blob/master/esm/index.js
/*
ISC License

Copyright (c) 2019, Andrea Giammarchi, @WebReflection

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE
OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
*/
var self = this || /* istanbul ignore next */ {};
try {
  self.WeakRef = WeakRef;
  /* istanbul ignore next */
  self.FinalizationGroup = FinalizationGroup;
}
catch (o_O) {
  // requires a global WeakMap (IE11+)
  (function (WeakMap, defineProperties) {
    var wr = new WeakMap;
    function WeakRef(value) {
      wr.set(this, value);
    }
    defineProperties(
      WeakRef.prototype,
      {
        deref: {
          value: function deref() {
            return wr.get(this);
          }
        }
      }
    );

    var fg = new WeakMap;
    function FinalizationGroup(fn) {
      fg.set(this, []);
    }
    defineProperties(
      FinalizationGroup.prototype,
      {
        register: {
          value: function register(value, name) {
            var names = fg.get(this);
            if (names.indexOf(name) < 0)
              names.push(name);
          }
        },
        unregister: {
          value: function unregister(value, name) {
            var names = fg.get(this);
            var i = names.indexOf(name);
            if (-1 < i)
              names.splice(i, 1);
            return -1 < i;
          }
        },
        cleanupSome: {
          value: function cleanupSome(fn) {
            fn(fg.get(this));
          }
        }
      }
    );

    self.WeakRef = WeakRef;
    self.FinalizationGroup = FinalizationGroup;

  }(WeakMap, Object.defineProperties));
}
export const { WeakRef, FinalizationGroup } = self;
