import { format, isPast, isToday } from "date-fns";
import { CalendarDays, Clock, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { PRIORITY_STYLES, describeRecurrence, tagColor, type Task } from "@/lib/kanban";

function fmtMinutes(m: number) {
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h${r}m` : `${h}h`;
}

interface Props {
  task: Task;
  onClick?: () => void;
  isDragging?: boolean;
  isOverlay?: boolean;
}

export function TaskCard({ task, onClick, isDragging, isOverlay }: Props) {
  const due = task.due_date ? new Date(task.due_date) : null;
  const overdue = due && isPast(due) && !isToday(due);
  const today = due && isToday(due);
  const priority = PRIORITY_STYLES[task.priority];
  const isDone = task.status === "done";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative w-full text-left rounded-xl bg-surface border border-border/70 p-4 shadow-card hover:shadow-lifted hover:-translate-y-0.5 transition-spring",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
        isDone && "bg-success/5 border-success/30",
        isDragging && !isOverlay && "opacity-40",
        isOverlay && "shadow-lifted rotate-2 scale-105 cursor-grabbing"
      )}
    >
      {/* priority accent bar */}
      <span className={cn("absolute left-0 top-3 bottom-3 w-1 rounded-r-full", priority.dot)} />

      <div className="flex items-start justify-between gap-2">
        <h3 className={cn("font-semibold text-sm leading-snug text-foreground line-clamp-2", isDone && "line-through text-muted-foreground")}>{task.title}</h3>
        <span className={cn("shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide", priority.chip)}>
          <span className={cn("h-1.5 w-1.5 rounded-full", priority.dot)} />
          {priority.label}
        </span>
      </div>

      {task.description && (
        <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">{task.description}</p>
      )}

      {task.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {task.tags.slice(0, 4).map((t) => (
            <Badge key={t} variant="outline" className={cn("border-transparent text-[10px] py-0 px-1.5 font-medium", tagColor(t))}>
              {t}
            </Badge>
          ))}
          {task.tags.length > 4 && (
            <span className="text-[10px] text-muted-foreground self-center">+{task.tags.length - 4}</span>
          )}
        </div>
      )}

      {due && (
        <div className="mt-3 flex items-center gap-1.5">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium",
              overdue
                ? "bg-destructive/10 text-destructive"
                : today
                ? "bg-warning/15 text-warning"
                : "bg-muted text-muted-foreground"
            )}
          >
            <CalendarDays className="h-3 w-3" />
            {format(due, "MMM d")}
          </span>
        </div>
      )}
    </button>
  );
}
