#!/usr/bin/env node
/** OmniView 源码结构轻量门禁。 */
import { existsSync, readdirSync, statSync } from 'node:fs'
import { extname, join, relative, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const SRC = join(ROOT, 'src')
const allowed = new Set(['.ts', '.tsx', '.css'])
const files = []
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const file = join(dir, name)
    if (statSync(file).isDirectory()) walk(file)
    else if (allowed.has(extname(name))) files.push(relative(ROOT, file))
  }
}
walk(SRC)
const required = ['src/app/App.tsx', 'src/main.tsx', 'src/shared/types.ts', 'src/features/viewers/ViewerRenderer.tsx']
const missing = required.filter((file) => !existsSync(join(ROOT, file)))
if (missing.length) {
  console.error(`❌ 结构门禁失败，缺少入口文件: ${missing.join(', ')}`)
  process.exit(1)
}
console.log(`✅ 结构门禁通过：扫描 ${files.length} 个源码文件，入口与 Viewer 目录存在。`)
