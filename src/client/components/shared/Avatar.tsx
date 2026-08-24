export function Avatar({ src, username, size = "medium" }: {
  src: string;
  username: string;
  size?: "small" | "medium" | "large";
}) {
  return <img className={`avatar avatar--${size}`} src={src} alt={`${username}'s profile`} />;
}
