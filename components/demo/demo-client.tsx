"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import Link from "next/link";

import { ArrowRight, ArrowUp, Loader2, Sparkles } from "lucide-react";

import { MarkdownContent } from "@/components/markdown-content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface DemoMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
}

const DEMO_MESSAGE_LIMIT = 20;

export default function DemoClient() {
  const [messages, setMessages] = useState<DemoMessage[]>([]);
  const [composer, setComposer] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const atLimit =
    messages.filter((m) => m.role === "user").length >= DEMO_MESSAGE_LIMIT / 2;

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  // Auto-scroll during streaming
  useEffect(() => {
    if (!isStreaming) return;
    const el = scrollRef.current;
    if (!el) return;
    const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (gap < 150) el.scrollTop = el.scrollHeight;
  }, [isStreaming, streamingText]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming || atLimit) return;

      const userMsg: DemoMessage = {
        id: crypto.randomUUID(),
        role: "user",
        text: text.trim(),
      };

      const updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);
      setComposer("");
      setIsStreaming(true);
      setStreamingText("");

      // Scroll after adding user message
      requestAnimationFrame(() => scrollToBottom());

      try {
        const res = await fetch("/api/v1/demo/stream", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
          body: JSON.stringify({
            messages: updatedMessages.map((m) => ({
              role: m.role,
              text: m.text,
            })),
          }),
        });

        if (!res.ok || !res.body) {
          throw new Error(`HTTP ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let accumulated = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          let idx;

          while ((idx = buffer.indexOf("\n\n")) !== -1) {
            const chunk = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            const lines = chunk.split("\n");

            let event: string | null = null;
            let data = "";

            for (const line of lines) {
              if (line.startsWith("event:")) event = line.slice(6).trim();
              else if (line.startsWith("data:")) data += line.slice(5).trim();
            }

            if (!event || !data) continue;

            try {
              const parsed = JSON.parse(data);

              if (event === "delta" && parsed.text) {
                accumulated += parsed.text;
                setStreamingText(accumulated);
              } else if (event === "final") {
                const finalText = parsed.text || accumulated;
                const assistantMsg: DemoMessage = {
                  id: crypto.randomUUID(),
                  role: "assistant",
                  text: finalText,
                };
                setMessages((prev) => [...prev, assistantMsg]);
                setStreamingText("");
                setIsStreaming(false);
              } else if (event === "error") {
                throw new Error(parsed.error?.message || "Stream error");
              }
            } catch (parseErr) {
              if (parseErr instanceof SyntaxError) {
                console.error("Failed to parse SSE:", data);
              } else {
                throw parseErr;
              }
            }
          }
        }

        // If stream ended without final event, commit what we have
        if (accumulated && isStreaming) {
          const assistantMsg: DemoMessage = {
            id: crypto.randomUUID(),
            role: "assistant",
            text: accumulated,
          };
          setMessages((prev) => [...prev, assistantMsg]);
          setStreamingText("");
          setIsStreaming(false);
        }
      } catch (err) {
        console.error("Demo stream error:", err);
        const errorMsg: DemoMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          text: "Sorry, something went wrong. Please try again.",
        };
        setMessages((prev) => [...prev, errorMsg]);
        setStreamingText("");
        setIsStreaming(false);
      }
    },
    [messages, isStreaming, atLimit, scrollToBottom]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendMessage(composer);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(composer);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-3xl mx-auto">
      {/* CTA Banner */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-primary/5">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4 text-primary" />
          <span>Demo mode &mdash; messages are not saved.</span>
        </div>
        <Link href="/auth/sign-up">
          <Button variant="outline" size="sm" className="text-xs h-7">
            Sign up for full access
            <ArrowRight className="ml-1.5 h-3 w-3" />
          </Button>
        </Link>
      </div>

      {/* Message List */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-6 space-y-4"
      >
        {messages.length === 0 && !isStreaming && (
          <div className="flex-1 flex items-center justify-center h-full">
            <div className="text-center space-y-4 max-w-md animate-in fade-in duration-700">
              <div className="relative mx-auto w-20 h-20 mb-2">
                <div className="absolute inset-0 bg-primary/10 rounded-full animate-pulse" />
                <div className="relative flex items-center justify-center h-full">
                  <span className="text-5xl">💬</span>
                </div>
              </div>
              <h2 className="text-2xl font-bold tracking-tight">
                Try Context Blocks
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Send a message to start chatting with the AI. This is a
                stateless demo &mdash; sign up to unlock branching, persistence,
                and more.
              </p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <DemoMessageItem key={msg.id} message={msg} />
        ))}

        {/* Streaming assistant message */}
        {isStreaming && streamingText && (
          <DemoMessageItem
            message={{
              id: "streaming",
              role: "assistant",
              text: streamingText,
            }}
            isStreaming
          />
        )}

        {/* Streaming indicator before first token */}
        {isStreaming && !streamingText && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm px-2 py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            Thinking...
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t p-4">
        {atLimit ? (
          <div className="text-center space-y-3 py-4">
            <p className="text-sm text-muted-foreground">
              You&apos;ve reached the demo limit.
            </p>
            <Link href="/auth/sign-up">
              <Button size="lg">
                Sign up for unlimited access
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex items-end gap-2">
            <Textarea
              ref={textareaRef}
              value={composer}
              onChange={(e) => setComposer(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              disabled={isStreaming}
              className="min-h-[44px] max-h-[200px] resize-none"
              rows={1}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!composer.trim() || isStreaming}
              className="h-[44px] w-[44px] shrink-0"
            >
              {isStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowUp className="h-4 w-4" />
              )}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

function DemoMessageItem({
  message,
  isStreaming,
}: {
  message: DemoMessage;
  isStreaming?: boolean;
}) {
  const isUser = message.role === "user";

  const config = isUser
    ? {
        label: "You",
        color:
          "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
        borderColor: "border-blue-500/30",
        icon: "👤",
      }
    : {
        label: "Assistant",
        color:
          "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20",
        borderColor: "border-purple-500/30",
        icon: "🤖",
      };

  return (
    <div
      className={`rounded-xl border-2 transition-all duration-200 bg-card ${config.borderColor} ${
        isStreaming ? "animate-pulse-subtle" : ""
      }`}
    >
      <div className="flex items-center px-5 pt-4 pb-2 border-b border-border/50">
        <Badge variant="outline" className={`font-semibold ${config.color}`}>
          <span className="mr-1.5">{config.icon}</span>
          {config.label}
        </Badge>
      </div>
      <div className="px-5 py-4">
        <MarkdownContent content={message.text} />
      </div>
    </div>
  );
}
