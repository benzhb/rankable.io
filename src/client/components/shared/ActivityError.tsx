export function ActivityError({ message }: { message: string }) {
  return <div className="activity-error" role="alert">{message}</div>;
}
