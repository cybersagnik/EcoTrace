export function formatRelativeMinutes(secondsAgo: number): string {
  const minutes = Math.round(secondsAgo / 60);
  if (minutes < 1) return "just now";
  if (minutes === 1) return "1m ago";
  return `${minutes}m ago`;
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
