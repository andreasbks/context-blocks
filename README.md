# GenAI Context Blocks Chat

**Modular, branchable AI chat platform built with Next.js, Supabase, and shadcn/ui.**

---

## Vision

GenAI Context Blocks Chat transforms the way you interact with AI:  
No more single-threaded conversations.  
**Branch, remix, and merge conversations**—explore ideas in parallel, build reusable knowledge blocks, and manage context flexibly.

---

## Features

-   **Branchable Context Blocks:** Any message can become a starting point for new ideas. Fork, branch, and compare conversations—like code, but for chat.
-   **Reusable & Global Context:** Save and re-inject context blocks anywhere across your chats. Build your own AI context library.
-   **Modern UI:** Beautiful, accessible, and composable interface with [shadcn/ui](https://ui.shadcn.com/), [Radix UI](https://www.radix-ui.com/), and Tailwind CSS.
-   **Reliable Backend:** Built on Supabase Postgres for data, auth, and scaling.
-   **Plug-and-Play LLMs:** Easily swap between OpenAI, Anthropic, or your own open-source models.
-   **Open Source & Extensible:** Modular architecture, ready for community contribution and custom extensions.

---

## Tech Stack

-   **Frontend & Custom Backend Logic:** [Next.js](https://nextjs.org/) (App Router)
    -   UI built with [shadcn/ui](https://ui.shadcn.com/), [Radix UI](https://www.radix-ui.com/), and [Tailwind CSS](https://tailwindcss.com/)
    -   API routes and server actions for all custom business logic (context branching, LLM calls, etc.)
-   **Database & Authentication:** [Supabase](https://supabase.com/)
    -   Managed Postgres database for storing chats, context blocks, and user data
    -   Built-in auth for secure user sign-up, login, and session management
-   **LLM Providers:** OpenAI, Anthropic, or local open-source models (plug-and-play adapters)
-   **Deployment:** [Vercel](https://vercel.com/) (or any platform that supports Next.js)

---

## Project Structure

```plaintext
.
├── app/             # Next.js App Router (UI pages, API routes)
│   ├── api/         # Backend logic (chat, blocks, LLM, auth)
│   └── ...          # UI pages (chat views, settings, etc.)
├── components/      # UI components (ChatTree, ContextBlock, etc.)
├── lib/             # Core business logic (Supabase, adapters, helpers)
├── public/          # Static assets
├── styles/          # Tailwind and global CSS
├── .env.example     # Example environment variables
├── README.md
└── ...
```

---

## The Concept: Conversational Blocks

Traditional chat is linear.  
**GenAI Context Blocks Chat** is nonlinear—built around modular “blocks” you can move, branch, remix, and reuse.

### What is a Block?

A **Block** is any discrete unit of context in a conversation:

-   A single message
-   A group of related messages
-   An imported document, file, or chunk of text
-   An LLM-generated summary or suggestion

**Blocks are modular and interactive—like Lego for ideas.**

---

### Why Blocks?

-   **Branch Your Thinking:**  
    Swipe or drag any block to the left to branch a new conversation—explore “what if” without losing your place.
-   **Ingest New Context Instantly:**  
    Drop in a block from another chat, your personal context library, or an external source. The LLM can reason with it immediately.
-   **Remix and Merge:**  
    Bring together blocks from different threads, merging insights or comparing alternatives. Remix ideas with a drag-and-drop.
-   **Organize Visually:**  
    Conversations become a canvas—a tree or graph—where context is clear and reusable.

---

### Example Interactions

-   **Swipe/Drag Left:**  
    Instantly forks a block into a new branch—start a parallel thread of thought.
-   **Swipe/Drag Right:**  
    Merge blocks or inject additional context from your saved collection.
-   **Long Press:**  
    Mark a block as important, add it to your global context library, or export for reuse elsewhere.
-   **Tap to Expand:**  
    View all sub-branches, see the “history of thought,” and jump between versions of a conversation.

---

### UX Philosophy

-   **Touch-first and Mouse-friendly:**  
    Blocks are made for **swiping, dragging, and tapping**—not just clicking.
-   **Nonlinear Creativity:**  
    Treat your AI conversations like a canvas or whiteboard.  
    Branch, experiment, rewind, and remix—just like creative work in Figma or Miro.
-   **Reusable Knowledge:**  
    Save blocks you love. Drop them into any chat, anytime.  
    Over time, build a personal or team context library.
-   **Visual Clarity:**  
    Every block shows its connections—branches, merges, origins.  
    See not just _what_ you discussed, but _how_ you arrived there.

---

### Sample Workflow

1. **Chat as normal.**
2. Get a new idea?  
   **Swipe a message left**—branch off into a new exploration.
3. Need more context?  
   **Drag in** a block from a previous conversation or your context library.
4. Want to compare?  
   **Visualize multiple branches** side-by-side, and even merge insights.

---

> **GenAI Context Blocks Chat** makes AI conversation as powerful, flexible, and creative as modern knowledge work.  
> It’s not just chat—it’s a collaborative canvas for branching, remixing, and building with context.

---

## How Blocks Work Technically

-   Each block is a node in a tree or graph structure, with parent(s), children, and connections.
-   Blocks can be stored, referenced, and reused globally.
-   All block operations—branching, merging, importing—are performed via intuitive UI gestures (swipe, drag, drop).

---

## Built for Extension

-   The “block” concept is extensible—future blocks can represent:
    -   File uploads, images, PDFs, audio, or code snippets
    -   LLM-powered summaries or workflows
    -   Integrations with other knowledge bases

---

## Help Us Build the Next Level of Conversational AI

This project is **open by design**—the “block” system is built to be forked, extended, and remixed by the community.  
Have a block type, a UI pattern, or a feature in mind? [Open a discussion or PR!](./CONTRIBUTING.md)

---
