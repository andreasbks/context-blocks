/**
 * Strip markdown syntax from text to display clean plain text
 * Useful for previews, tooltips, and other UI elements where markdown rendering isn't needed
 */
export function stripMarkdown(text: string): string {
  if (!text) return "";

  return (
    text
      // Remove code blocks (both ``` and single backticks)
      .replace(/```[\s\S]*?```/g, "[code]")
      .replace(/`([^`]+)`/g, "$1")
      // Remove headers
      .replace(/^#{1,6}\s+/gm, "")
      // Remove bold/italic
      .replace(/(\*\*|__)(.*?)\1/g, "$2")
      .replace(/(\*|_)(.*?)\1/g, "$2")
      // Remove links [text](url) -> text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      // Remove images ![alt](url) -> [image]
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, "[image]")
      // Remove blockquotes
      .replace(/^>\s+/gm, "")
      // Remove horizontal rules
      .replace(/^(-{3,}|_{3,}|\*{3,})$/gm, "")
      // Remove list markers
      .replace(/^[\s]*[-*+]\s+/gm, "")
      .replace(/^[\s]*\d+\.\s+/gm, "")
      // Remove HTML tags
      .replace(/<[^>]*>/g, "")
      // Clean up extra whitespace
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}
