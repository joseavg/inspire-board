import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TaskCard } from "./TaskCard";
import type { Task, TaskStatus } from "@/lib/kanban";

interface ColumnProps {
  id: TaskStatus;
  title: string;
  accent: string;
  gradient: string;
  emoji: string;
  tasks: Task[];
  onAdd: () => void;
  onTaskClick: (task: Task) => void;
}

function SortableTask({ task, onClick }: { task: Task; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "task", task },
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="touch-none">
      <TaskCard task={task} onClick={onClick} isDragging={isDragging} />
    </div>
  );
}

export function KanbanColumn({ id, title, accent, gradient, emoji, tasks, onAdd, onTaskClick }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id, data: { type: "column", status: id } });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "relative flex flex-col rounded-2xl bg-column border border-border/60 p-3 transition-spring min-h-[200px] overflow-hidden",
        "before:absolute before:inset-0 before:bg-gradient-to-b before:pointer-events-none before:opacity-100",
        `before:${gradient}`,
        isOver && "border-accent/70 ring-2 ring-accent/30 scale-[1.01] shadow-lifted"
      )}
    >
      {/* Top color bar */}
      <div className={cn("absolute top-0 left-0 right-0 h-1", accent)} />

      <div className="relative flex items-center justify-between px-2 py-1.5">
        <div className="flex items-center gap-2">
          <span className="text-base leading-none">{emoji}</span>
          <h2 className="font-semibold text-sm">{title}</h2>
          <span className={cn("text-xs rounded-full px-2 py-0.5 font-semibold text-white shadow-sm", accent)}>{tasks.length}</span>
        </div>
        <Button size="icon" variant="ghost" className="h-7 w-7 hover:bg-surface" onClick={onAdd} aria-label={`Add task to ${title}`}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="relative flex-1 mt-2 space-y-2.5 overflow-y-auto scrollbar-thin px-1 pb-1">
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <SortableTask key={task.id} task={task} onClick={() => onTaskClick(task)} />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <button
            onClick={onAdd}
            className="w-full mt-2 rounded-xl border-2 border-dashed border-border/70 hover:border-accent/50 hover:bg-accent-soft/40 transition-base p-6 text-sm text-muted-foreground hover:text-accent flex flex-col items-center gap-1.5"
          >
            <Plus className="h-4 w-4" />
            <span>Add a task</span>
          </button>
        )}
      </div>
    </div>
  );
}
