import React, { useEffect, useState } from "react";

import Dashboard from "./Dashboard";
import TopBar from "./TopBar";

const FRONTEND_URL = process.env.REACT_APP_FRONTEND_URL || "http://localhost:3000";

/**
 * Parse a simple key=value&key=value string from a URL hash.
 * Hash may look like: #tp_token=eyJ...&tp_user=%7B%22id%22...%7D
 */
function parseHash(hash) {
  const result = {};
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  raw.split("&").forEach((part) => {
    const eqIdx = part.indexOf("=");
    if (eqIdx === -1) return;
    const key = part.slice(0, eqIdx);
    const val = part.slice(eqIdx + 1);
    result[key] = val;
  });
  return result;
}

const Home = () => {
  // Initialise auth synchronously from URL hash or existing localStorage.
  // This runs before the first render so we never flash the dashboard
  // to an unauthenticated user.
  const [isAuthed] = useState(() => {
    // 1. Check URL hash for a freshly-delivered token from the frontend.
    const hash = window.location.hash;
    if (hash && hash.includes("tp_token=")) {
      const params = parseHash(hash);
      const token = params["tp_token"];
      const rawUser = params["tp_user"];

      if (token) {
        localStorage.setItem("tradepulse_token", token);
        if (rawUser) {
          try {
            localStorage.setItem(
              "tradepulse_user",
              JSON.stringify(JSON.parse(decodeURIComponent(rawUser)))
            );
          } catch (_) {}
        }
        // Remove the hash so the token doesn't stay in the address bar.
        window.history.replaceState(null, "", window.location.pathname);
        return true;
      }
    }

    // 2. Already have a stored token from a previous session.
    return !!localStorage.getItem("tradepulse_token");
  });

  useEffect(() => {
    if (!isAuthed) {
      window.location.href = `${FRONTEND_URL}/signup`;
    }
  }, [isAuthed]);

  if (!isAuthed) {
    return null; // Render nothing while redirect is in progress.
  }

  return (
    <>
      <TopBar />
      <Dashboard />
    </>
  );
};

export default Home;
