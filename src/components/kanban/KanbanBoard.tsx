import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { supabase } from "@/integrations/supabase/client";
import { COLUMNS, nextOccurrence, type Recurrence, type Task, type TaskStatus } from "@/lib/kanban";
import { celebrate } from "@/lib/confetti";
import { KanbanColumn } from "./KanbanColumn";
import { TaskCard } from "./TaskCard";
import { TaskDialog, type TaskFormValues } from "./TaskDialog";
import { toast } from "sonner";

interface Props {
  userId: string;
  onBoardChange?: () => void;
}

export function KanbanBoard({ userId, onBoardChange }: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<TaskStatus>("todo");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // Initial load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", userId)
        .order("position", { ascending: true });
      if (cancelled) return;
      if (error) {
        toast.error("Could not load tasks");
      } else {
        setTasks(((data ?? []) as unknown) as Task[]);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  // Realtime sync (handles AI-driven changes too)
  useEffect(() => {
    const channel = supabase
      .channel("tasks-board")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks", filter: `user_id=eq.${userId}` },
        (payload) => {
          setTasks((prev) => {
            if (payload.eventType === "INSERT") {
              const t = (payload.new as unknown) as Task;
              if (prev.some((x) => x.id === t.id)) return prev;
              return [...prev, t].sort((a, b) => a.position - b.position);
            }
            if (payload.eventType === "UPDATE") {
              const t = (payload.new as unknown) as Task;
              const prevTask = prev.find((x) => x.id === t.id);
              if (prevTask && prevTask.status !== "done" && t.status === "done") {
                celebrate();
                toast.success("🎉 Task complete!");
              }
              return prev.map((x) => (x.id === t.id ? t : x)).sort((a, b) => a.position - b.position);
            }
            if (payload.eventType === "DELETE") {
              const t = (payload.old as unknown) as Task;
              return prev.filter((x) => x.id !== t.id);
            }
            return prev;
          });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const tasksByColumn = useMemo(() => {
    const map: Record<TaskStatus, Task[]> = { todo: [], in_progress: [], done: [] };
    for (const t of tasks) {
      if (map[t.status]) map[t.status].push(t);
    }
    for (const k of Object.keys(map) as TaskStatus[]) {
      map[k].sort((a, b) => a.position - b.position);
    }
    return map;
  }, [tasks]);

  const findTask = (id: string) => tasks.find((t) => t.id === id) ?? null;

  const handleDragStart = (e: DragStartEvent) => {
    const t = findTask(String(e.active.id));
    setActiveTask(t);
  };

  const handleDragEnd = async (e: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = e;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const activeTaskItem = findTask(activeId);
    if (!activeTaskItem) return;

    // Determine destination column
    let destStatus: TaskStatus = activeTaskItem.status;
    let destIndex = -1;
    if (overId === "todo" || overId === "in_progress" || overId === "done") {
      destStatus = overId as TaskStatus;
      destIndex = tasksByColumn[destStatus].length;
    } else {
      const overTask = findTask(overId);
      if (!overTask) return;
      destStatus = overTask.status;
      destIndex = tasksByColumn[destStatus].findIndex((t) => t.id === overId);
    }

    // Build new column order
    const sourceCol = tasksByColumn[activeTaskItem.status].filter((t) => t.id !== activeId);
    let destCol = activeTaskItem.status === destStatus ? sourceCol.slice() : tasksByColumn[destStatus].slice();
    if (destIndex < 0 || destIndex > destCol.length) destIndex = destCol.length;
    destCol.splice(destIndex, 0, { ...activeTaskItem, status: destStatus });

    // Compute new position (midpoint between neighbors)
    const before = destCol[destIndex - 1]?.position;
    const after = destCol[destIndex + 1]?.position;
    let newPos: number;
    if (before == null && after == null) newPos = 1000;
    else if (before == null) newPos = (after as number) - 500;
    else if (after == null) newPos = (before as number) + 500;
    else newPos = ((before as number) + (after as number)) / 2;

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === activeId ? { ...t, status: destStatus, position: newPos } : t))
    );

    const movedToDone = destStatus === "done" && activeTaskItem.status !== "done";
    const movedToInProgress = destStatus === "in_progress" && activeTaskItem.status !== "in_progress";
    const movedAwayFromDone = activeTaskItem.status === "done" && destStatus !== "done";

    // Build update payload — track timing transitions
    const update: {
      status: TaskStatus;
      position: number;
      started_at?: string;
      completed_at?: string | null;
      actual_minutes?: number;
    } = { status: destStatus, position: newPos };
    let computedActual: number | null = null;
    if (movedToInProgress && !activeTaskItem.started_at) {
      update.started_at = new Date().toISOString();
    }
    if (movedToDone) {
      const now = new Date();
      update.completed_at = now.toISOString();
      const startMs = activeTaskItem.started_at ? new Date(activeTaskItem.started_at).getTime() : null;
      if (startMs) {
        computedActual = Math.max(1, Math.round((now.getTime() - startMs) / 60000));
        update.actual_minutes = computedActual;
      }
    }
    if (movedAwayFromDone) {
      update.completed_at = null;
    }

    const { error } = await supabase
      .from("tasks")
      .update(update)
      .eq("id", activeId);
    if (error) {
      toast.error("Could not save change");
      return;
    }

    if (movedToDone) {
      celebrate();
      const timeMsg = computedActual ? ` (took ${computedActual}m)` : "";
      toast.success(`🎉 Nice work — task complete!${timeMsg}`);
      // If recurring, spawn the next occurrence
      if (activeTaskItem.recurrence && activeTaskItem.due_date) {
        await spawnNextOccurrence(activeTaskItem);
      }
    }
    onBoardChange?.();
  };

  const spawnNextOccurrence = async (task: Task) => {
    if (!task.recurrence || !task.due_date) return;
    const next = nextOccurrence(new Date(task.due_date), task.recurrence);
    if (!next) {
      toast.info("🔁 Recurring series finished");
      return;
    }
    // Decrement count if endType=after
    let nextRule: Recurrence = task.recurrence;
    if (nextRule.endType === "after" && nextRule.count) {
      nextRule = { ...nextRule, count: nextRule.count - 1 };
    }
    const colTasks = tasksByColumn["todo"];
    const lastPos = colTasks[colTasks.length - 1]?.position ?? 0;
    const { error } = await supabase.from("tasks").insert({
      user_id: userId,
      title: task.title,
      description: task.description,
      status: "todo",
      priority: task.priority,
      tags: task.tags,
      due_date: next.toISOString(),
      estimated_minutes: task.estimated_minutes,
      recurrence: (nextRule as unknown) as never,
      position: lastPos + 1000,
    });
    if (!error) toast.success("🔁 Next occurrence scheduled");
  };

  const openNew = (status: TaskStatus) => {
    setEditingTask(null);
    setDefaultStatus(status);
    setDialogOpen(true);
  };
  const openEdit = (task: Task) => {
    setEditingTask(task);
    setDialogOpen(true);
  };

  const handleSubmit = async (values: TaskFormValues) => {
    const payload = {
      user_id: userId,
      title: values.title,
      description: values.description || null,
      status: values.status,
      priority: values.priority,
      tags: values.tags,
      due_date: values.due_date ? values.due_date.toISOString() : null,
      estimated_minutes: values.estimated_minutes,
      recurrence: (values.recurrence as unknown) as never,
    };
    if (editingTask) {
      const { error } = await supabase.from("tasks").update(payload).eq("id", editingTask.id);
      if (error) toast.error("Could not save");
      else { toast.success("Task updated"); onBoardChange?.(); }
    } else {
      const colTasks = tasksByColumn[values.status];
      const lastPos = colTasks[colTasks.length - 1]?.position ?? 0;
      const { error } = await supabase.from("tasks").insert({ ...payload, position: lastPos + 1000 });
      if (error) toast.error("Could not create");
      else { toast.success("Task created"); onBoardChange?.(); }
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) toast.error("Could not delete");
    else { toast.success("Task deleted"); setDialogOpen(false); onBoardChange?.(); }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 p-5">
        {COLUMNS.map((c) => (
          <div key={c.id} className="rounded-2xl bg-column border border-border/60 p-4 h-[420px] animate-pulse-soft" />
        ))}
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 p-5 h-full">
        {COLUMNS.map((col) => (
          <KanbanColumn
            key={col.id}
            id={col.id}
            title={col.title}
            accent={col.accent}
            gradient={col.gradient}
            emoji={col.emoji}
            tasks={tasksByColumn[col.id]}
            onAdd={() => openNew(col.id)}
            onTaskClick={openEdit}
          />
        ))}
      </div>

      <DragOverlay>{activeTask ? <TaskCard task={activeTask} isOverlay /> : null}</DragOverlay>

      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialStatus={defaultStatus}
        task={editingTask}
        onSubmit={handleSubmit}
        onDelete={editingTask ? handleDelete : undefined}
      />
    </DndContext>
  );
}
