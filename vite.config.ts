import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

function hostname(value: string | undefined): string | undefined {
  const input = value?.trim();
  if (!input) return undefined;
  return new URL(input.includes("://") ? input : `https://${input}`).hostname;
}

export default defineConfig(({ mode }) => {
  const configEnv = loadEnv(mode, process.cwd(), "");
  const publicHostname = hostname(configEnv.PUBLIC_HOSTNAME);
  const discordClientId = configEnv.VITE_DISCORD_CLIENT_ID?.trim();

  return {
    plugins: [react()],
    root: ".",
    build: {
      outDir: "dist/client",
      emptyOutDir: true,
    },
    server: {
      hmr: publicHostname
        ? {
            protocol: "wss",
            host: publicHostname,
            clientPort: 443,
            path: "/__vite_hmr",
          }
        : { path: "/__vite_hmr" },
      allowedHosts: publicHostname
        ? [
            publicHostname,
            discordClientId ? `${discordClientId}.discordsays.com` : "localhost",
            "localhost",
          ]
        : ["localhost", "127.0.0.1"],
    },
  };
});
