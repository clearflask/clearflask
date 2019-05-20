
var showNotification = function(data) {
  self['registration'].showNotification(
    data.notificationTitle,
    data.notificationOptions)
}

var pushListener = function(event) {
  event['waitUntil'](showNotification(JSON.parse(event.data.text())));
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
