export function formatRelativeMinutes(secondsAgo: number): string {
  const minutes = Math.round(secondsAgo / 60);
  if (minutes < 1) return "just now";
  if (minutes === 1) return "1m ago";
  return `${minutes}m ago`;
}

/**
 * Format a Date / ISO string / timestamp as a human "…ago" label
 * (e.g. "just now", "12m ago", "3h ago", "2d ago").
 */
export function timeAgo(date?: Date | string | number): string {
  const d = date ? new Date(date) : new Date();
  if (isNaN(d.getTime())) return "recently";
  const seconds = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Format a Date, string, or timestamp into Real-Time India Standard Time (IST - Asia/Kolkata).
 * Ensures 100% accurate 12-hour format (e.g. 06:04:27 PM).
 */
export function formatIndiaTime(date?: Date | string | number): string {
  try {
    const d = date ? new Date(date) : new Date();
    if (isNaN(d.getTime())) {
      return new Date().toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
    }
    return d.toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  } catch {
    return new Date().toLocaleTimeString();
  }
}
