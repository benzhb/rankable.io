import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useDiscordActivity } from "./discord/DiscordProvider.js";
import { ActivityError } from "./components/shared/ActivityError.js";
import { LoadingScreen } from "./components/shared/LoadingScreen.js";
import { GamePage } from "./pages/GamePage.js";
import { HomePage } from "./pages/HomePage.js";

export function App() {
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
