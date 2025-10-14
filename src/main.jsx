import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./styles.css"; // <— importante

function hideSplash() {
  const el = document.getElementById("splash");
  if (el) {
    requestAnimationFrame(() => el.classList.add("hidden-splash"));
    setTimeout(() => el.remove?.(), 600);
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App onReady={hideSplash} />
  </React.StrictMode>
);

// SW
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const swUrl = `/service-worker.js?ts=${Date.now()}`;
    navigator.serviceWorker.register(swUrl).catch(console.error);
  });
}
