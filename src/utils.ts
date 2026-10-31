export function dateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function offsetDate(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return dateKey(date);
}
export function formatDate(
  value: string,
  options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" },
): string {
  if (!value) return "Not set";
  const d = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(d.getTime())
    ? "Invalid date"
    : d.toLocaleDateString("en-US", options);
}
export function dueLabel(value: string): string {
  if (!value) return "No deadline";
  if (value === dateKey()) return "Today";
  if (value === offsetDate(1)) return "Tomorrow";
  return formatDate(value);
}
export function daysUntil(value: string): number {
  return Math.ceil(
    (new Date(value + "T12:00:00").getTime() -
      new Date(dateKey() + "T12:00:00").getTime()) /
      86400000,
  );
}
export function safeUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    if (url.protocol === "https:" || url.protocol === "http:") return url.href;
  } catch {
    /* Local build notes have no external URL. */
  }
  return undefined;
}
export function downloadFile(
  name: string,
  content: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
