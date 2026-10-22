#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2025-2026 Canwork LLC
//
// The layout engine lives in its own repo and reaches this app only as the
// @ginexys/layout-engine package. This check fails if engine code comes back:
//   - a src/extraction, src/ir or src/workers directory reappears, or
//   - a file imports the engine by path (../../layout-engine, node_modules,
//     or the package's private src/ folder) instead of its public exports.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];

for (const dir of ['src/extraction', 'src/ir', 'src/workers']) {
    if (fs.existsSync(path.join(root, dir))) {
        problems.push(`${dir}/ exists. Engine code belongs in @ginexys/layout-engine.`);
    }
}

const BAD = [
    [/['"][^'"]*layout-engine\/src\//, 'imports the package\'s private src/ folder'],
    [/['"](?:\.\.?\/)+[^'"]*layout-engine\//, 'imports the engine repo by relative path'],
    [/['"][^'"]*node_modules\/@ginexys\//, 'imports the engine through node_modules'],
];
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    return /\.(m?js|cjs|ts)$/.test(e.name) ? [p] : [];
});
for (const dir of ['src', 'test', 'scripts']) {
    const abs = path.join(root, dir);
    if (!fs.existsSync(abs)) continue;
    for (const file of walk(abs)) {
        if (file === fileURLToPath(import.meta.url)) continue;
        const lines = fs.readFileSync(file, 'utf8').split('\n');
        lines.forEach((line, i) => {
            if (!/\b(import|from|require|new URL)\b/.test(line)) return;
            for (const [re, why] of BAD) {
                if (re.test(line)) problems.push(`${path.relative(root, file)}:${i + 1} ${why}`);
            }
        });
    }
}

if (problems.length) {
    console.error('engineBoundary failed:\n  ' + problems.join('\n  '));
    process.exit(1);
}
console.log('engineBoundary: ok');
