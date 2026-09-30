#!/usr/bin/env node
/**
 * Univer 模块环境准备与离线依赖完整性保障脚本
 * 解决 Windows 环境下 npm 解压 scoped 包时偶发的 package.json 锁死与丢失问题
 * 作者: 周赞
 */
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { execSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const UNIVER_DIR = path.join(ROOT, 'node_modules', '@univerjs');

const PACKAGES = [
  'core',
  'design',
  'engine-formula',
  'engine-render',
  'sheets',
  'sheets-ui',
  'ui',
  'sheets-formula',
  'sheets-formula-ui',
  'sheets-numfmt',
  'icons',
  'protocol',
  'rpc',
  'telemetry',
  'themes',
  'docs',
  'docs-ui',
  'drawing',
];

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, response => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        downloadFile(response.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', err => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

function safeCopyRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  for (const item of fs.readdirSync(src)) {
    const s = path.join(src, item);
    const d = path.join(dest, item);
    const stat = fs.statSync(s);
    if (stat.isDirectory()) {
      safeCopyRecursive(s, d);
    } else {
      if (!fs.existsSync(d) || item === 'package.json') {
        try {
          fs.copyFileSync(s, d);
        } catch (e) {
          // ignore locked files
        }
      }
    }
  }
}

async function main() {
  console.log('🚀 开始验证与补全 Univer 全套核心依赖...');
  if (!fs.existsSync(UNIVER_DIR)) {
    fs.mkdirSync(UNIVER_DIR, { recursive: true });
  }

  const tmpDir = path.join(ROOT, '.univer-temp');
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  for (const pkg of PACKAGES) {
    const targetPkgDir = path.join(UNIVER_DIR, pkg);
    const targetJson = path.join(targetPkgDir, 'package.json');

    if (fs.existsSync(targetJson)) {
      continue;
    }

    console.log(`📦 正在下载并补全 @univerjs/${pkg}...`);
    const tarName = `${pkg}-1.0.2.tgz`;
    const tarPath = path.join(tmpDir, tarName);
    const url = `https://registry.npmjs.org/@univerjs/${pkg}/-/${pkg}-1.0.2.tgz`;

    try {
      if (!fs.existsSync(tarPath)) {
        await downloadFile(url, tarPath);
      }

      const extractDir = path.join(tmpDir, `extracted_${pkg}`);
      if (fs.existsSync(extractDir)) {
        fs.rmSync(extractDir, { recursive: true, force: true });
      }
      fs.mkdirSync(extractDir, { recursive: true });

      execSync(`tar -xzf "${tarPath}" -C "${extractDir}"`);
      const extractedPackage = path.join(extractDir, 'package');

      if (fs.existsSync(extractedPackage)) {
        safeCopyRecursive(extractedPackage, targetPkgDir);
      }
      fs.rmSync(extractDir, { recursive: true, force: true });
      console.log(`✅ @univerjs/${pkg} 补全成功 (package.json exists: ${fs.existsSync(targetJson)})`);
    } catch (err) {
      console.error(`❌ 处理 @univerjs/${pkg} 失败:`, err.message);
    }
  }

  // 清理临时目录
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (e) {}

  console.log('🎉 Univer 全套核心模块准备就绪！');
}

main().catch(console.error);
