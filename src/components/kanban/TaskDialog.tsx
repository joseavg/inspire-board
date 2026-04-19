import { useEffect, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, X, Trash2, Repeat, Clock } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import {
  PRIORITY_STYLES,
  WEEKDAYS,
  describeRecurrence,
  type Recurrence,
  type RecurrenceFreq,
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
  estimated_minutes: number | null;
  recurrence: Recurrence | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialStatus?: TaskStatus;
  task?: Task | null;
  onSubmit: (values: TaskFormValues) => Promise<void> | void;
  onDelete?: (id: string) => Promise<void> | void;
}

const DEFAULT_RECURRENCE: Recurrence = {
  freq: "weekly",
  interval: 1,
  byweekday: [new Date().getDay()],
  endType: "never",
  endDate: null,
  count: null,
};

function minutesToHM(mins: number | null): string {
  if (!mins || mins <= 0) return "";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

export function TaskDialog({ open, onOpenChange, initialStatus = "todo", task, onSubmit, onDelete }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>(initialStatus);
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [estimateMinutes, setEstimateMinutes] = useState<string>("");
  const [recurrence, setRecurrence] = useState<Recurrence | null>(null);
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
      setEstimateMinutes(task?.estimated_minutes ? String(task.estimated_minutes) : "");
      setRecurrence(task?.recurrence ?? null);
    }
  }, [open, task, initialStatus]);

  const addTag = () => {
    const t = tagInput.trim();
    if (!t || tags.includes(t)) return;
    setTags([...tags, t]);
    setTagInput("");
  };

  const toggleWeekday = (day: number) => {
    if (!recurrence) return;
    const current = recurrence.byweekday ?? [];
    const next = current.includes(day) ? current.filter((d) => d !== day) : [...current, day];
    setRecurrence({ ...recurrence, byweekday: next });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      const est = parseInt(estimateMinutes, 10);
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        status,
        priority,
        tags,
        due_date: dueDate,
        estimated_minutes: Number.isFinite(est) && est > 0 ? est : null,
        recurrence,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const recurrenceEnabled = recurrence !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
                  <SelectItem value="todo">📝 To-do</SelectItem>
                  <SelectItem value="in_progress">⚡ In Progress</SelectItem>
                  <SelectItem value="done">✅ Done</SelectItem>
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

          <div className="grid grid-cols-2 gap-3">
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
              <Label htmlFor="est" className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> Estimate (min)
              </Label>
              <Input
                id="est"
                type="number"
                min={0}
                step={5}
                value={estimateMinutes}
                onChange={(e) => setEstimateMinutes(e.target.value)}
                placeholder="e.g. 45"
              />
              {estimateMinutes && parseInt(estimateMinutes, 10) > 0 && (
                <p className="text-[11px] text-muted-foreground">≈ {minutesToHM(parseInt(estimateMinutes, 10))}</p>
              )}
            </div>
          </div>

          {/* Actual time spent (read-only display when present) */}
          {task && (task.actual_minutes || task.started_at) && (
            <div className="rounded-lg bg-secondary/40 border border-border/60 px-3 py-2 text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
              <Clock className="h-3.5 w-3.5" />
              {task.actual_minutes ? (
                <span>
                  Actual time: <span className="font-medium text-foreground">{minutesToHM(task.actual_minutes)}</span>
                </span>
              ) : (
                <span>Started — timer running…</span>
              )}
              {task.estimated_minutes && task.actual_minutes ? (
                <span className={cn(task.actual_minutes > task.estimated_minutes ? "text-destructive" : "text-success")}>
                  ({task.actual_minutes > task.estimated_minutes ? "+" : "-"}
                  {minutesToHM(Math.abs(task.actual_minutes - task.estimated_minutes))} vs estimate)
                </span>
              ) : null}
            </div>
          )}

          {/* Recurrence */}
          <div className="space-y-3 rounded-lg border border-border/60 p-3 bg-secondary/20">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5 cursor-pointer">
                <Repeat className="h-3.5 w-3.5" /> Repeat
              </Label>
              <Switch
                checked={recurrenceEnabled}
                onCheckedChange={(checked) => setRecurrence(checked ? { ...DEFAULT_RECURRENCE } : null)}
              />
            </div>
            {recurrenceEnabled && recurrence && (
              <div className="space-y-3 animate-fade-in">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Every</Label>
                    <Input
                      type="number"
                      min={1}
                      value={recurrence.interval}
                      onChange={(e) => setRecurrence({ ...recurrence, interval: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Frequency</Label>
                    <Select
                      value={recurrence.freq}
                      onValueChange={(v) => setRecurrence({ ...recurrence, freq: v as RecurrenceFreq })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Day(s)</SelectItem>
                        <SelectItem value="weekly">Week(s)</SelectItem>
                        <SelectItem value="monthly">Month(s)</SelectItem>
                        <SelectItem value="yearly">Year(s)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {recurrence.freq === "weekly" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">On</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {WEEKDAYS.map((d) => {
                        const active = (recurrence.byweekday ?? []).includes(d.value);
                        return (
                          <button
                            key={d.value}
                            type="button"
                            onClick={() => toggleWeekday(d.value)}
                            className={cn(
                              "h-8 w-8 rounded-full text-xs font-semibold transition-spring",
                              active ? "gradient-accent text-accent-foreground shadow-sm" : "bg-secondary text-secondary-foreground hover:bg-secondary/70"
                            )}
                            aria-label={d.label}
                          >
                            {d.short}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-xs">Ends</Label>
                  <Select
                    value={recurrence.endType ?? "never"}
                    onValueChange={(v) =>
                      setRecurrence({
                        ...recurrence,
                        endType: v as "never" | "on" | "after",
                        endDate: v === "on" ? recurrence.endDate ?? format(new Date(), "yyyy-MM-dd") : null,
                        count: v === "after" ? recurrence.count ?? 10 : null,
                      })
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="never">Never</SelectItem>
                      <SelectItem value="on">On date</SelectItem>
                      <SelectItem value="after">After N occurrences</SelectItem>
                    </SelectContent>
                  </Select>
                  {recurrence.endType === "on" && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button type="button" variant="outline" className="w-full justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {recurrence.endDate ? format(new Date(recurrence.endDate), "PPP") : "Pick end date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={recurrence.endDate ? new Date(recurrence.endDate) : undefined}
                          onSelect={(d) => setRecurrence({ ...recurrence, endDate: d ? format(d, "yyyy-MM-dd") : null })}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                  )}
                  {recurrence.endType === "after" && (
                    <Input
                      type="number"
                      min={1}
                      value={recurrence.count ?? 10}
                      onChange={(e) => setRecurrence({ ...recurrence, count: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                      placeholder="Number of occurrences"
                    />
                  )}
                </div>

                <p className="text-[11px] text-muted-foreground italic">{describeRecurrence(recurrence)}</p>
              </div>
            )}
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
