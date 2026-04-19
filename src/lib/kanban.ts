export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high";

export type RecurrenceFreq = "daily" | "weekly" | "monthly" | "yearly";

// 0 = Sunday … 6 = Saturday (matches JS Date.getDay)
export interface Recurrence {
  freq: RecurrenceFreq;
  interval: number; // every N units
  byweekday?: number[]; // weekly only
  endType?: "never" | "on" | "after";
  endDate?: string | null; // ISO date if endType === "on"
  count?: number | null; // remaining occurrences if endType === "after"
}

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  tags: string[];
  due_date: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  estimated_minutes: number | null;
  actual_minutes: number | null;
  started_at: string | null;
  completed_at: string | null;
  recurrence: Recurrence | null;
}

export const WEEKDAYS = [
  { value: 0, short: "S", label: "Sun" },
  { value: 1, short: "M", label: "Mon" },
  { value: 2, short: "T", label: "Tue" },
  { value: 3, short: "W", label: "Wed" },
  { value: 4, short: "T", label: "Thu" },
  { value: 5, short: "F", label: "Fri" },
  { value: 6, short: "S", label: "Sat" },
];

export function describeRecurrence(r: Recurrence | null | undefined): string {
  if (!r) return "";
  const i = r.interval || 1;
  let base = "";
  if (r.freq === "daily") base = i === 1 ? "Daily" : `Every ${i} days`;
  else if (r.freq === "weekly") {
    if (r.byweekday && r.byweekday.length > 0) {
      const days = r.byweekday
        .slice()
        .sort()
        .map((d) => WEEKDAYS[d].label.slice(0, 3))
        .join(", ");
      base = i === 1 ? `Weekly on ${days}` : `Every ${i} weeks on ${days}`;
    } else base = i === 1 ? "Weekly" : `Every ${i} weeks`;
  } else if (r.freq === "monthly") base = i === 1 ? "Monthly" : `Every ${i} months`;
  else base = i === 1 ? "Yearly" : `Every ${i} years`;

  if (r.endType === "on" && r.endDate) base += ` until ${r.endDate}`;
  else if (r.endType === "after" && r.count) base += ` · ${r.count} left`;
  return base;
}

// Compute the next due date from a current due date and recurrence rule.
// Returns null when the rule has ended.
export function nextOccurrence(currentDue: Date, r: Recurrence): Date | null {
  if (r.endType === "after" && (r.count ?? 0) <= 1) return null;
  const i = Math.max(1, r.interval || 1);
  let next = new Date(currentDue.getTime());

  if (r.freq === "daily") {
    next.setDate(next.getDate() + i);
  } else if (r.freq === "weekly") {
    if (r.byweekday && r.byweekday.length > 0) {
      const sorted = r.byweekday.slice().sort((a, b) => a - b);
      // Find next weekday after current
      let d = new Date(next.getTime());
      d.setDate(d.getDate() + 1);
      for (let attempt = 0; attempt < 8 * i; attempt++) {
        if (sorted.includes(d.getDay())) {
          next = d;
          break;
        }
        d.setDate(d.getDate() + 1);
      }
      // For interval > 1 we still advance one weekday slot; close-enough for v1
    } else {
      next.setDate(next.getDate() + 7 * i);
    }
  } else if (r.freq === "monthly") {
    next.setMonth(next.getMonth() + i);
  } else {
    next.setFullYear(next.getFullYear() + i);
  }

  if (r.endType === "on" && r.endDate) {
    const end = new Date(r.endDate);
    if (next > end) return null;
  }
  return next;
}


export const COLUMNS: { id: TaskStatus; title: string; accent: string; gradient: string; emoji: string }[] = [
  { id: "todo", title: "To-do", accent: "bg-tag-2", gradient: "from-[hsl(var(--tag-2)/0.18)] to-transparent", emoji: "📝" },
  { id: "in_progress", title: "In Progress", accent: "bg-warning", gradient: "from-[hsl(var(--warning)/0.20)] to-transparent", emoji: "⚡" },
  { id: "done", title: "Done", accent: "bg-success", gradient: "from-[hsl(var(--success)/0.20)] to-transparent", emoji: "✅" },
];

export const PRIORITY_STYLES: Record<TaskPriority, { label: string; dot: string; chip: string }> = {
  low: {
    label: "Low",
    dot: "bg-priority-low",
    chip: "bg-priority-low-soft text-priority-low",
  },
  medium: {
    label: "Medium",
    dot: "bg-priority-medium",
    chip: "bg-priority-medium-soft text-priority-medium",
  },
  high: {
    label: "High",
    dot: "bg-priority-high",
    chip: "bg-priority-high-soft text-priority-high",
  },
};

const TAG_PALETTE = [
  "bg-[hsl(var(--tag-1-soft))] text-[hsl(var(--tag-1))]",
  "bg-[hsl(var(--tag-2-soft))] text-[hsl(var(--tag-2))]",
  "bg-[hsl(var(--tag-3-soft))] text-[hsl(var(--tag-3))]",
  "bg-[hsl(var(--tag-4-soft))] text-[hsl(var(--tag-4))]",
  "bg-[hsl(var(--tag-5-soft))] text-[hsl(var(--tag-5))]",
  "bg-[hsl(var(--tag-6-soft))] text-[hsl(var(--tag-6))]",
];

export function tagColor(tag: string) {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = (hash * 31 + tag.charCodeAt(i)) >>> 0;
  return TAG_PALETTE[hash % TAG_PALETTE.length];
}
