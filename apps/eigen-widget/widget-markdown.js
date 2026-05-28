/** Safe, lightweight markdown for assistant replies (no HTML passthrough). */

export function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderAssistantMarkdown(text) {
  const blocks = String(text || '')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  if (blocks.length === 0) return '';

  return blocks
    .map((block) => {
      const lines = block.split('\n');
      const isList = lines.every((line) => /^[-*•]\s+/.test(line.trim()) || line.trim() === '');
      if (isList) {
        const items = lines
          .map((line) => line.trim())
          .filter((line) => /^[-*•]\s+/.test(line))
          .map((line) => `<li>${inlineMarkdown(line.replace(/^[-*•]\s+/, ''))}</li>`)
          .join('');
        return `<ul class="md-list">${items}</ul>`;
      }
      return `<p>${inlineMarkdown(block.replace(/\n/g, ' '))}</p>`;
    })
    .join('');
}

function inlineMarkdown(text) {
  let out = escapeHtml(text);
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  out = out.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
  );
  return out;
}
