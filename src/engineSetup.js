// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2025-2026 Canwork LLC
//
// Host configuration for @ginexys/layout-engine. The engine has no bundler of
// its own, so the app tells it where the pdf.js worker is served from. This
// module must be the first import in app.js: pdfAnalyzer applies the worker
// URL when it loads. The VS Code webview's __VSC_PDF_WORKER_SRC__ still wins.
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { setPdfWorkerSrc } from '@ginexys/layout-engine/extraction/util/assetBase';

setPdfWorkerSrc(pdfWorkerUrl);
