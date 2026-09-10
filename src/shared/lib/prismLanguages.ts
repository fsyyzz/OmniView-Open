import Prism from 'prismjs';

// Load language components for Prism syntax highlighting
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-diff';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-csharp';
import 'prismjs/components/prism-markdown';

export function highlightCode(code: string, language?: string): string {
  if (!language) {
    return escapeHtml(code);
  }
  const lang = language.toLowerCase().trim();

  const langMap: Record<string, string> = {
    js: 'javascript',
    ts: 'typescript',
    py: 'python',
    rs: 'rust',
    sh: 'bash',
    shell: 'bash',
    zsh: 'bash',
    yml: 'yaml',
    html: 'markup',
    xml: 'markup',
    svg: 'markup',
    cs: 'csharp',
    golang: 'go',
    rb: 'ruby',
  };

  const mappedLang = langMap[lang] || lang;
  const grammar = Prism.languages[mappedLang];

  if (grammar) {
    try {
      return Prism.highlight(code, grammar, mappedLang);
    } catch {
      return escapeHtml(code);
    }
  }
  return escapeHtml(code);
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
