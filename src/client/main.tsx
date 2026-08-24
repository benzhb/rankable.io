import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App.js";
import { ActivitySoundEffects } from "./audio/ActivitySoundEffects.js";
import { AudioProvider } from "./audio/AudioProvider.js";
import { DiscordProvider } from "./discord/DiscordProvider.js";
import "./styles/global.css";
import "./styles/home.css";
import "./styles/game.css";

const root = document.getElementById("root");
if (!root) throw new Error("Root element is missing");

createRoot(root).render(
  <BrowserRouter>
    <AudioProvider>
      <DiscordProvider>
        <ActivitySoundEffects />
        <App />
      </DiscordProvider>
    </AudioProvider>
  </BrowserRouter>,
);
