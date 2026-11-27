if (navigator.serviceWorker) {
  navigator.serviceWorker.register("/service-worker.js").catch(error => {
    console.warn("Crew konnte den Verbindungs-Hinweis nicht aktivieren.", error);
  });
}
