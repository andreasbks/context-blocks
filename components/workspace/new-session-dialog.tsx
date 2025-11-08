"use client";

import { useState } from "react";

import { Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface NewSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (firstMessage: string) => void;
  isCreating?: boolean;
}

export function NewSessionDialog({
  open,
  onOpenChange,
  onSubmit,
  isCreating = false,
}: NewSessionDialogProps) {
  const [message, setMessage] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = message.trim();
    if (trimmed) {
      onSubmit(trimmed);
      setMessage("");
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!isCreating) {
      onOpenChange(newOpen);
      if (!newOpen) {
        setMessage("");
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        hideCloseButton
        className="sm:max-w-[600px] p-0 border-2 border-primary/30 bg-card hover:border-primary/40 transition-colors"
      >
        <DialogTitle className="sr-only">Start a New Session</DialogTitle>
        <form onSubmit={handleSubmit} className="w-full">
          {/* Block Header */}
          <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-border/50">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="text-xs font-medium bg-primary/10 text-primary border-primary/30"
              >
                <Sparkles className="mr-1 h-3 w-3" />
                New Session
              </Badge>
              {message.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {message.length} characters
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="submit"
                size="sm"
                disabled={!message.trim() || isCreating}
                className="min-w-[100px]"
              >
                {isCreating ? (
                  <span className="animate-pulse">Creating...</span>
                ) : (
                  <>
                    Start
                    <span className="ml-1.5">→</span>
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleOpenChange(false)}
                disabled={isCreating}
                className="h-8 px-2"
              >
                ✕
              </Button>
            </div>
          </div>

          {/* Content Area */}
          <div className="px-4 py-3">
            <Textarea
              placeholder="Type your first message to start a new session... (Press Enter to send, Shift+Enter for new line)"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              rows={4}
              disabled={isCreating}
              className="resize-none border-0 p-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent placeholder:text-muted-foreground/50"
              autoFocus
            />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
