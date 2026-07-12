export const bookingStatusStyles: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  awaiting_payment: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  confirmed: "bg-accent/15 text-accent",
  rejected: "bg-destructive/15 text-destructive",
  completed: "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground",
};

export const bookingStatusLabels: Record<string, string> = {
  pending: "Pending",
  awaiting_payment: "Awaiting payment",
  confirmed: "Confirmed",
  rejected: "Rejected",
  completed: "Completed",
  cancelled: "Cancelled",
};

const MONTH_ABBREVS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function formatBookingDate(date: string): string {
  const bookingDate = new Date(`${date}T12:00:00`);
  const day = bookingDate.getDate().toString().padStart(2, "0");
  const month = MONTH_ABBREVS[bookingDate.getMonth()];
  const year = bookingDate.getFullYear();
  return `${day} ${month} ${year}`;
}

export function formatBookingTime(date: Date): string {
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function formatBookingTimeRange(startTime?: string, endTime?: string): string {
  if (!startTime && !endTime) return "All day";
  if (startTime && endTime) return `${startTime}–${endTime}`;
  if (startTime) return `Starts at ${startTime}`;
  return `Ends at ${endTime}`;
}

export function getBookingWindow(date: string, startTime?: string, endTime?: string) {
  const start = new Date(`${date}T${startTime ?? "09:00"}:00`);
  const end = new Date(`${date}T${endTime ?? "18:00"}:00`);
  return { start, end };
}

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function getBookingTiming(date: string, startTime?: string, endTime?: string, now = new Date()) {
  const { start, end } = getBookingWindow(date, startTime, endTime);
  if (now < start) {
    return {
      status: "upcoming",
      label: "Starts in",
      detail: formatDuration(start.getTime() - now.getTime()),
      exitTime: end,
    };
  }

  if (now <= end) {
    return {
      status: "in_progress",
      label: "Time remaining",
      detail: formatDuration(end.getTime() - now.getTime()),
      exitTime: end,
    };
  }

  return {
    status: "completed",
    label: "Ended",
    detail: formatDuration(now.getTime() - end.getTime()),
    exitTime: end,
  };
}
