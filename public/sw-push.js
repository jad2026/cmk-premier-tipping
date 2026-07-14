/*
 * Push notification service worker.
 *
 * This is intentionally kept separate from the next-pwa generated worker
 * (public/sw.js) so that push handling is decoupled from offline/caching
 * behaviour. It is registered explicitly by src/hooks/usePushNotifications.ts
 * at a distinct scope so the two workers never conflict.
 */

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (err) {
    // Fall back to plain text if the payload isn't JSON.
    payload = { body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Club Rugby Tipping";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/apple-icon.png",
    badge: payload.badge || "/apple-icon.png",
    tag: payload.tag,
    data: {
      url: payload.url || "/",
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Focus an existing tab on the same origin if one is open.
        for (const client of clientList) {
          const clientUrl = new URL(client.url);
          const target = new URL(targetUrl, self.location.origin);
          if (clientUrl.origin === target.origin && "focus" in client) {
            client.navigate(target.href);
            return client.focus();
          }
        }
        // Otherwise open a new window.
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});
