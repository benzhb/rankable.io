import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App.js";
import "./styles/global.css";
import "./styles/home.css";
import "./styles/game.css";
import "./styles/legal.css";

const root = document.getElementById("root");
if (!root) throw new Error("Root element is missing");

createRoot(root).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
