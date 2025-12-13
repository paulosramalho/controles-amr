import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css"; // ⬅️ ISSO É O MAIS IMPORTANTE

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);