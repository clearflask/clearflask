import windowIso from "../windowIso";

export function intercomLoad(APP_ID) {
  if (windowIso.isSsr) return;
  // https://developers.intercom.com/installing-intercom/docs/basic-javascript
  (function () {
    var w = windowIso;
    var ic = w.Intercom;
    if (typeof ic === "function") {
      ic('reattach_activator');
      ic('update', w.intercomSettings);
    } else {
      var d = document;
      var i = function () {
        i.c(arguments);
      };
      i.q = [];
      i.c = function (args) {
        i.q.push(args);
      };
      w.Intercom = i;
      var l = function () {
        var s = d.createElement('script');
        s.type = 'text/javascript';
        s.async = true;
        s.src = 'https://widget.intercom.io/widget/' + APP_ID;
        var x = d.getElementsByTagName('script')[0];
        x.parentNode.insertBefore(s, x);
      };
      if (document.readyState === 'complete') {
        l();
      } else if (w.attachEvent) {
        w.attachEvent('onload', l);
      } else {
        w.addEventListener('load', l, false);
      }
    }
  })();
}

export function intercomStart(APP_ID, userData) {
  if (windowIso.isSsr) return;
  windowIso.Intercom("boot", {
    app_id: APP_ID,
    ...userData,
  });
}

export function intercomUpdate(APP_ID, userData) {
  if (windowIso.isSsr) return;
  windowIso.Intercom("update", {
    app_id: APP_ID,
    ...userData,
  });
}

export function intercomShutdown(APP_ID) {
  if (windowIso.isSsr) return;
  windowIso.Intercom("shutdown", {
    app_id: APP_ID,
  });
}
