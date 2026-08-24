export function LoadingScreen({ message = "Connecting to Discord…" }: { message?: string }) {
  return (
    <main className="status-screen">
      <div className="spinner" aria-hidden="true" />
      <p>{message}</p>
    </main>
  );
}
