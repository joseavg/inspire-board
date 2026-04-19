import { useEffect, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, X, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  PRIORITY_STYLES,
  type Task,
  type TaskPriority,
  type TaskStatus,
  tagColor,
} from "@/lib/kanban";

export interface TaskFormValues {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  tags: string[];
  due_date: Date | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialStatus?: TaskStatus;
  task?: Task | null;
  onSubmit: (values: TaskFormValues) => Promise<void> | void;
  onDelete?: (id: string) => Promise<void> | void;
}

export function TaskDialog({ open, onOpenChange, initialStatus = "todo", task, onSubmit, onDelete }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>(initialStatus);
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(task?.title ?? "");
      setDescription(task?.description ?? "");
      setStatus(task?.status ?? initialStatus);
      setPriority(task?.priority ?? "medium");
      setTags(task?.tags ?? []);
      setTagInput("");
      setDueDate(task?.due_date ? new Date(task.due_date) : null);
    }
  }, [open, task, initialStatus]);

  const addTag = () => {
    const t = tagInput.trim();
    if (!t || tags.includes(t)) return;
    setTags([...tags, t]);
    setTagInput("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSubmit({ title: title.trim(), description: description.trim(), status, priority, tags, due_date: dueDate });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{task ? "Edit task" : "New task"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs to be done?" autoFocus />
          </div>
          <div className="space-y-2">
            <Label htmlFor="desc">Description</Label>
            <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Add some context…" rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">To-do</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PRIORITY_STYLES) as TaskPriority[]).map((p) => (
                    <SelectItem key={p} value={p}>
                      <span className="flex items-center gap-2">
                        <span className={cn("h-2 w-2 rounded-full", PRIORITY_STYLES[p].dot)} />
                        {PRIORITY_STYLES[p].label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Due date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" className={cn("w-full justify-start text-left font-normal", !dueDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dueDate ? format(dueDate, "PPP") : "Pick a date"}
                  {dueDate && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); setDueDate(null); }}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); setDueDate(null); } }}
                      className="ml-auto inline-flex items-center justify-center rounded p-1 hover:bg-muted cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dueDate ?? undefined} onSelect={(d) => setDueDate(d ?? null)} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-2">
              {tags.map((t) => (
                <Badge key={t} variant="outline" className={cn("border-transparent gap-1.5 pr-1", tagColor(t))}>
                  {t}
                  <button type="button" onClick={() => setTags(tags.filter((x) => x !== t))} className="rounded-sm hover:bg-black/5 p-0.5">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(); }
              }}
              placeholder="Type a tag and press Enter"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-2 flex-row-reverse sm:flex-row-reverse justify-between sm:justify-between items-center">
            {task && onDelete ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => onDelete(task.id)} className="text-destructive hover:text-destructive hover:bg-destructive/10 mr-auto">
                <Trash2 className="h-4 w-4 mr-1.5" /> Delete
              </Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={saving || !title.trim()} className="gradient-accent text-accent-foreground border-0">
                {saving ? "Saving…" : task ? "Save changes" : "Create task"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
