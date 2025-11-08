"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DeleteGraphDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  graphTitle: string | null;
  onConfirm: () => void;
  isDeleting?: boolean;
}

export function DeleteGraphDialog({
  open,
  onOpenChange,
  graphTitle,
  onConfirm,
  isDeleting = false,
}: DeleteGraphDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Session</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete{" "}
            <span className="font-semibold text-foreground">
              {graphTitle || "Untitled Session"}
            </span>
            ? This action cannot be undone and will permanently delete all
            messages and data in this session.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete Session"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
