

console.log('Running tests...');

const assertConsoleLines = new Set([
  'ClearFlask Greenlock Manager Started',
  'ClearFlask Greenlock Store Started',
  'ClearFlask Greenlock Http Challenge Started',
  'Master Started',
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

require('./greenlock/greenlock-manager-clearflask').create();
require('./greenlock/greenlock-challenge-http-clearflask').create();
require('./greenlock/greenlock-store-clearflask').create();
