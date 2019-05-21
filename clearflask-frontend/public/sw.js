
var isClientFocused = function() {
  return clients.matchAll({
    type: 'window',
    includeUncontrolled: true
  })
  .then((windowClients) => {
    let clientIsFocused = false;

    for (let i = 0; i < windowClients.length; i++) {
      const windowClient = windowClients[i];
      if (windowClient.focused) {
        clientIsFocused = true;
        break;
      }
    }

    return clientIsFocused;
  });
}

var notifyAllOpen = function(projectId) {
  windowClients.forEach((windowClient) => {
    windowClient.postMessage({
      type: 'update-notification-list',
      projectId: projectId,
    });
  });
}

var showNotification = function(data) {
  self['registration'].showNotification(
    data.notificationTitle,
    data.notificationOptions)
}

var pushListener = function(event) {
  var data = event.data.json();
  event['waitUntil'](isClientFocused().then(isFocused => {
    notifyAllOpen(data.projectId)
    if(!isFocused) {
      showNotification(data)
    }
  }));
};

var notificationClickListener = function(event) {
  event.notification.close();

  switch(event.action){
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
