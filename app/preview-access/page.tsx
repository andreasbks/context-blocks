"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { AlertTriangle, Lock } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

export default function PreviewAccessPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [hasReadTerms, setHasReadTerms] = useState(false);
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!hasAcceptedTerms) {
      toast.error("Please accept the terms and conditions to continue");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/preview-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        toast.success("Access granted! Redirecting...");
        // Small delay for user feedback before redirect
        setTimeout(() => {
          router.push("/");
          router.refresh();
        }, 500);
      } else {
        const data = await response.json();
        toast.error(data.error || "Invalid access code");
      }
    } catch (error) {
      toast.error("Failed to verify access code. Please try again.");
      console.error("Preview access error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-neutral-50 dark:bg-neutral-950">
      <div className="w-full max-w-4xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="p-4 bg-primary/10 rounded-full">
              <Lock className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-3xl font-bold">Preview Access Required</h1>
          <p className="text-muted-foreground">
            This application is currently in preview mode and requires an access
            code
          </p>
        </div>

        {/* Main Card */}
        <Card className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Password Input */}
            <div className="space-y-2">
              <Label htmlFor="password">Access Code</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your access code"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                required
                className="text-lg h-12"
              />
            </div>

            <Separator />

            {/* Legal Notice Header */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <h2 className="text-xl font-semibold">
                  Important Legal Notice
                </h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Please carefully read and understand the following terms before
                accessing this preview application.
              </p>
            </div>

            {/* Legal Text Scroll Area */}
            <ScrollArea className="h-64 w-full border rounded-lg p-6 bg-neutral-50 dark:bg-neutral-900">
              <div className="space-y-4 text-sm leading-relaxed">
                <div className="p-4 border-2 border-amber-600 dark:border-amber-500 rounded-lg bg-amber-50 dark:bg-amber-950/30">
                  <p className="font-semibold text-amber-900 dark:text-amber-100 text-center">
                    ⚠️ Preview Notice
                  </p>
                  <p className="mt-2 text-center">
                    This private preview is for testing only — not a public or
                    production service. Please don’t share sensitive or
                    confidential data.
                  </p>
                </div>

                <p>
                  When you access this page, certain personal data are processed
                  automatically — for example your IP address, browser
                  information, and account details from Clerk. Anything you type
                  (messages or content) may be sent to <strong>OpenAI</strong>{" "}
                  to generate responses. Hosting and related infrastructure are
                  provided by <strong>Vercel</strong> (EU/US),
                  <strong>Clerk</strong> (US), <strong>OpenAI</strong> (US), and
                  <strong>Langfuse</strong> (EU).
                </p>

                <p>
                  We process these data only to make the demo work, maintain
                  security, and understand basic usage. Data may be deleted at
                  any time without notice. Don’t rely on this preview for
                  storage or critical work.
                </p>

                <p>
                  You can request deletion or information about your data
                  anytime at{" "}
                  <span className="font-mono">andreas.bakakis@gmail.com</span>.
                  .
                </p>

                <p className="text-xs text-muted-foreground text-center mt-4">
                  Last Updated:{" November 9, 2025"}
                </p>
              </div>
            </ScrollArea>

            {/* Checkboxes */}
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="read-terms"
                  checked={hasReadTerms}
                  onCheckedChange={(checked) =>
                    setHasReadTerms(checked === true)
                  }
                  disabled={isSubmitting}
                />
                <label
                  htmlFor="read-terms"
                  className="text-sm leading-relaxed cursor-pointer"
                >
                  I have read and scrolled through the entire legal notice and
                  terms above
                </label>
              </div>

              <div className="flex items-start space-x-3">
                <Checkbox
                  id="accept-terms"
                  checked={hasAcceptedTerms}
                  onCheckedChange={(checked) =>
                    setHasAcceptedTerms(checked === true)
                  }
                  disabled={isSubmitting || !hasReadTerms}
                />
                <label
                  htmlFor="accept-terms"
                  className="text-sm leading-relaxed cursor-pointer"
                >
                  I understand and accept all terms, conditions, and risks
                  outlined above, including data processing, third-party
                  services, and limitations of liability
                </label>
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full h-12 text-base"
              disabled={isSubmitting || !hasAcceptedTerms}
            >
              {isSubmitting ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Verifying...
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-4 w-4" />
                  Access Preview Application
                </>
              )}
            </Button>
          </form>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground">
          This is a preview/beta version. Access is restricted to authorized
          users only.
        </p>
      </div>
    </div>
  );
}
