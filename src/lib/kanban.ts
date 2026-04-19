export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high";

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
