# System Prompt Configuration

## Overview

A system prompt is automatically prepended to all LLM interactions in Context Blocks. This ensures
consistent behavior and formatting across all assistant responses.

## Default System Prompt

The default system prompt includes:

- Role definition as a helpful AI assistant
- Guidelines for markdown formatting
- Instructions for code syntax highlighting
- Guidance on handling uncertainty
- Context about branching conversations

See `lib/ai/system-prompt.ts` for the full default prompt.

## Customization

You can customize the system prompt in two ways:

### 1. Environment Variable (Recommended for Production)

Set the `SYSTEM_PROMPT` environment variable in your `.env` file:

```bash
SYSTEM_PROMPT="You are a specialized AI assistant for [your use case].
Always respond in a friendly, professional tone...
[your custom instructions]"
```

### 2. Code Modification (For Development)

Edit the `DEFAULT_SYSTEM_PROMPT` constant in `lib/ai/system-prompt.ts`:

```typescript
const DEFAULT_SYSTEM_PROMPT = `Your custom prompt here...`;
```

## Where It's Applied

The system prompt is automatically added to:

- **Generate Stream** (`POST /api/v1/branches/:id/generate/stream`) - When generating assistant
  responses
- **Send Stream** (`POST /api/v1/branches/:id/send/stream`) - When sending messages and getting
  responses

## Implementation Details

1. `buildPromptWithSystem()` prepends the system prompt to user context
2. The prompt is separated from user context with a visual separator (`---`)
3. System prompt is fetched on each request, allowing runtime updates via environment variables

## Best Practices

- Keep the prompt concise but clear
- Include formatting guidelines (markdown, code blocks)
- Set the tone and personality
- Mention any domain-specific knowledge or constraints
- Test thoroughly after changes

## Example Custom Prompts

### Technical Documentation Assistant

```
You are a technical documentation expert. Always:
- Use clear, precise language
- Include code examples with proper syntax highlighting
- Structure responses with headings and lists
- Link to relevant documentation when appropriate
```

### Educational Tutor

```
You are a patient educational tutor. When answering:
- Break down complex topics into simple steps
- Use analogies and examples
- Ask clarifying questions when needed
- Encourage critical thinking
- Celebrate progress and understanding
```

### Code Review Assistant

```
You are a senior software engineer conducting code reviews. Focus on:
- Code quality and best practices
- Security vulnerabilities
- Performance considerations
- Maintainability and readability
- Suggest specific improvements with examples
```
