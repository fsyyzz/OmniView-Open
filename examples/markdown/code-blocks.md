# 代码块示例

代码块应该具备清晰的语言标识、行号、横向滚动和复制操作。

## TypeScript

```typescript
type Result<T> = { ok: true; value: T } | { ok: false; error: Error };

export async function loadDocument(path: string): Promise<Result<string>> {
  try {
    const response = await fetch(`/api/documents?path=${encodeURIComponent(path)}`);
    if (!response.ok) throw new Error(`Request failed: ${response.status}`);
    return { ok: true, value: await response.text() };
  } catch (error) {
    return { ok: false, error: error as Error };
  }
}
```

## Python

```python
from dataclasses import dataclass

@dataclass(frozen=True)
class Document:
    title: str
    sections: list[str]

def section_count(document: Document) -> int:
    return len(document.sections)
```

## JSON

```json
{
  "name": "omniview",
  "version": "0.1.0",
  "features": ["markdown", "mermaid", "plantuml"]
}
```

## Shell

```bash
npm install
npm run lint
npm run package:vsix
```
