import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { FEEDBACK_TYPES, type FeedbackType, useUsageTracking } from "@/lib/usageTracking";

export function FeedbackWidget() {
  const auth = useAuth();
  const location = useLocation();
  const { submitFeedback } = useUsageTracking();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>("general_feedback");
  const [message, setMessage] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "sent" | "error">("idle");
  const [error, setError] = useState("");
  const dealId = useMemo(() => location.pathname.match(/^\/deal\/([^/]+)/)?.[1] ?? null, [location.pathname]);

  if (!auth.user) return null;

  const handleSubmit = async () => {
    if (!message.trim()) {
      setError("Please add a short message.");
      setStatus("error");
      return;
    }
    setStatus("saving");
    setError("");
    try {
      await submitFeedback({
        type,
        message,
        dealId,
        sourceUrl: sourceUrl.trim() || null,
        metadata: { user_agent: navigator.userAgent },
      });
      setStatus("sent");
      setMessage("");
      setSourceUrl("");
      window.setTimeout(() => {
        setOpen(false);
        setStatus("idle");
      }, 900);
    } catch (saveError) {
      setStatus("error");
      setError(saveError instanceof Error ? saveError.message : "Feedback could not be sent.");
    }
  };

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 gap-2 rounded-full shadow-xl"
        size="sm"
      >
        <MessageSquare className="h-4 w-4" />
        Feedback
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send feedback</DialogTitle>
            <DialogDescription>Tell us what is useful, broken, missing, or worth adding next.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="space-y-1.5 text-sm">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Type</span>
              <Select value={type} onValueChange={(value) => setType(value as FeedbackType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FEEDBACK_TYPES.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Message</span>
              <Textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="What should we know?" className="min-h-28" />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Source URL, optional</span>
              <Input value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://..." />
            </label>
            <div className="text-xs text-muted-foreground">
              Current page: {location.pathname}{dealId ? ` · Deal ID: ${dealId}` : ""}
            </div>
            {status === "sent" && <div className="text-sm text-signal-green">Thanks, feedback sent.</div>}
            {status === "error" && <div className="text-sm text-signal-red">{error}</div>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="button" disabled={status === "saving"} onClick={() => void handleSubmit()}>
              {status === "saving" ? "Sending..." : "Send feedback"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
