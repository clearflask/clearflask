// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
console.log('Running tests...');

const assertConsoleLines = new Set([
  'Master started (test)',
  'Worker started #test',
]);
var testLog = console.log.bind(console);
const isFork = process.send !== undefined;
if (!isFork) {
  ["info", "log", "warn", "error"].forEach(function (method) {
    var oldMethod = console[method].bind(console);
    console[method] = function () {
      oldMethod.apply(
        console,
        arguments
      );
      const line = Array.prototype.join.call(arguments, ' ');
      if (line && assertConsoleLines.delete(line)) {
        testLog('PASSED:', line);
        if (assertConsoleLines.size <= 0) {
          testLog('PASSED ALL');
          process.exit(0);
        }
      }
    };
  });
  setTimeout(() => {
    console.log('FAILED: still waiting for', assertConsoleLines);
    process.exit(100);
  }, 10000);
}

require('./bootstrap');
