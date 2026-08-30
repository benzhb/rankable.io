import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { ActivitySoundEffects } from "./audio/ActivitySoundEffects.js";
import { AudioProvider } from "./audio/AudioProvider.js";
import { useDiscordActivity } from "./discord/DiscordProvider.js";
import { DiscordProvider } from "./discord/DiscordProvider.js";
import { ActivityError } from "./components/shared/ActivityError.js";
import { LoadingScreen } from "./components/shared/LoadingScreen.js";
import { GamePage } from "./pages/GamePage.js";
import { HomePage } from "./pages/HomePage.js";
import { PrivacyPolicyPage } from "./pages/PrivacyPolicyPage.js";
import { TermsOfServicePage } from "./pages/TermsOfServicePage.js";

export function App() {
  return (
    <Routes>
      <Route path="/privacy" element={<PrivacyPolicyPage />} />
      <Route path="/tos" element={<TermsOfServicePage />} />
      <Route path="/*" element={<ActivityApplication />} />
    </Routes>
  );
}

function ActivityApplication() {
  return (
    <AudioProvider>
      <DiscordProvider>
        <ActivitySoundEffects />
        <ActivityRoutes />
      </DiscordProvider>
    </AudioProvider>
  );
}

function ActivityRoutes() {
  const { snapshot, loading, error } = useDiscordActivity();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!snapshot) return;
    const gamePhase = snapshot.phase === "PLAYING" || snapshot.phase === "RESULTS";
    const target = gamePhase && snapshot.round ? `/game/${snapshot.round.id}` : "/";
    if (location.pathname !== target) navigate(target, { replace: true });
  }, [snapshot, location.pathname, navigate]);

  if (loading) return <LoadingScreen />;
  if (!snapshot) return <main className="status-screen"><ActivityError message={error ?? "Unable to load the Activity"} /></main>;

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/game/:roundId" element={<GamePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
