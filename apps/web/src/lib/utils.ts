export function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(" ")
}

export function timeAgo(date: string | number | Date) {
  return Intl.RelativeTimeFormat
    ? new Intl.RelativeTimeFormat(undefined, { numeric: "auto" })
        .format(Math.round((+new Date(date) - Date.now()) / 60000), "minute")
    : ""
} 