// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
var notifyAllOpen = function (projectId) {
  return clients.matchAll({
    type: 'window',
    includeUncontrolled: true
  })
    .then((windowClients) => {
      let clientIsFocused = false;

      windowClients.forEach((windowClient) => {
        if (windowClient.focused) {
          clientIsFocused = true;
        }
        windowClient.postMessage({
          type: 'update-notification-list',
          projectId: projectId,
        });
      });

      return clientIsFocused;
    });
}

var showNotification = function (data) {
  self['registration'].showNotification(
    data.notificationTitle,
    data.notificationOptions)
}

var pushListener = function (event) {
  var data = event.data.json();
  event['waitUntil'](notifyAllOpen(data.projectId).then(isFocused => {
    if (!isFocused) {
      showNotification(data)
    }
  }));
};

var notificationClickListener = function (event) {
  event.notification.close();

  switch (event.action) {
    case 'open_url':
      if (clients.openWindow) {
        clients.openWindow(event.notification.data.url);
      }
      break;
  }
};

self.addEventListener('push', pushListener);
self.addEventListener('notificationclick', notificationClickListener);
// TODO self.addEventListener('notificationclose', notificationCloseListener);
