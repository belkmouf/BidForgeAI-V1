export function stripMarkdownCodeFences(content: string): string {
  if (!content) return '';
  
  let result = content.trim();
  
  const backtickFencePattern = /^[ \t]*```[ \t]*[\w.+#_{}()-]*\s*$/gmi;
  result = result.replace(backtickFencePattern, '');
  
  const tildeFencePattern = /^[ \t]*~~~[ \t]*[\w.+#_{}()-]*\s*$/gmi;
  result = result.replace(tildeFencePattern, '');
  
  return result.trim();
}

export function sanitizeModelHtml(rawOutput: string): string {
  if (!rawOutput) return '';
  
  let html = stripMarkdownCodeFences(rawOutput);
  
  html = html.replace(/^\s*[\r\n]+/, '');
  html = html.replace(/[\r\n]+\s*$/, '');
  
  return html;
}
