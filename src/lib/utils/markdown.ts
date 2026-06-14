import { marked } from 'marked';

export function parseMarkdown(text: string): string {
  if (!text) return '';

  try {
    // Parse using marked. We can ensure it's synchronous by passing async: false or just calling marked.parse
    const html = marked.parse(text, { async: false, breaks: true, gfm: true }) as string;
    return html;
  } catch (e) {
    console.error('Error parsing markdown:', e);
    return text;
  }
}
