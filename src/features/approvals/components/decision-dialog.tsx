"use client";

import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentUser } from "@/features/access-control/hooks/use-access";

import { decide, type DecisionInput } from "../api/approvals-api";
import type { ApprovalRequest } from "../types/approval";

export type DecisionAction = DecisionInput["action"];

const copy: Record<DecisionAction, { title: string; button: string; description: string; label: string }> = {
  approve: { title: "Approve", button: "Approve", description: "", label: "Comment (optional)" },
  reject: { title: "Reject", button: "Reject", description: "The request is closed and nothing changes. The requester sees your reason.", label: "Reason (required)" },
  return: { title: "Return for correction", button: "Return", description: "The requester can correct it and resubmit; approval then starts again.", label: "What needs correcting (required)" },
};

// Approve, reject or return a request's current level, with a comment.
export function DecisionDialog({
  request,
  action,
  onOpenChange,
  onDecided,
}: {
  request: ApprovalRequest | null;
  action: DecisionAction | null;
  onOpenChange: (open: boolean) => void;
  onDecided?: (request: ApprovalRequest, action: DecisionAction) => void;
}) {
  const open = request !== null && action !== null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open && (
          <DecisionForm
            request={request}
            action={action}
            onDone={(next) => {
              onDecided?.(next, action);
              onOpenChange(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function DecisionForm({ request, action, onDone }: { request: ApprovalRequest; action: DecisionAction; onDone: (request: ApprovalRequest) => void }) {
  const { user: actor } = useCurrentUser();
  const id = useId();
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const level = request.levels[request.currentLevel];
  const last = request.currentLevel === request.levels.length - 1;
  const text = copy[action];

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {text.title} {request.reference}
        </DialogTitle>
        <DialogDescription>
          {request.summary}.{" "}
          {action === "approve"
            ? last
              ? "This is the final approval: the change is applied now."
              : `Approves level ${request.currentLevel + 1} of ${request.levels.length} (${level.name}); the next level is asked next.`
            : text.description}
        </DialogDescription>
      </DialogHeader>
      <label htmlFor={id} className="text-sm font-medium">
        {text.label}
      </label>
      <Textarea id={id} value={comment} onChange={(event) => setComment(event.target.value)} rows={3} />
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>Back</DialogClose>
        <Button
          variant={action === "reject" ? "destructive" : "default"}
          onClick={async () => {
            setError("");
            try {
              onDone(await decide(actor.id, request.id, { action, comment }));
            } catch (cause) {
              // The module's own checks (e.g. not enough stock) surface here too.
              setError(cause instanceof Error ? cause.message : "Couldn't record the decision.");
            }
          }}
        >
          {text.button}
        </Button>
      </DialogFooter>
    </>
  );
}
