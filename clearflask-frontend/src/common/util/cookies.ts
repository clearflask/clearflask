// SPDX-FileCopyrightText: 2022-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
class Cookies {
  static instance: Cookies;

  static getInstance(): Cookies {
    return this.instance || (this.instance = new this());
  }

  get(name: string): string | undefined {
    var ca = document.cookie.split(';');
    for (var i = 0; i < ca.length; i++) {
      var c = ca[i];
      while (c.charAt(0) === ' ') c = c.substring(1, c.length);
      if (c.indexOf(name) === 0) return c.substring(name.length, c.length);
    }
    return undefined;
  }

  set(name: string, value: string, days?: number): void {
    var expires = '';
    if (days !== undefined) {
      var date = new Date();
      date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
      expires = '; expires=' + date.toUTCString();
    }
    document.cookie = name + '=' + value + expires + '; path=/';
  }

  unset(name): void {
    document.cookie = name + '=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
  }
}

export default Cookies;
