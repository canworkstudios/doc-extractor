# PDF Extractor

PDF Extractor is a high-performance, browser-native engineering pipeline for structured document extraction. It converts complex PDF layouts into clean, editable HTML and Markdown without data ever leaving your machine.

## 🚀 Key Features

*   **Browser-Native Extraction**: High-speed PDF parsing using `pdf.js` and local Web Workers.
*   **Structured Output**: Layout-aware conversion to HTML with CSS preservation.
*   **Comparison Engine**:
    *   **Visual Diff**: Side-by-side verification of original PDF vs extracted output.
    *   **Compare Diff**: Split and Unified version tracking between two PDF files.
*   **Rich Text Editor**: Built-in editor specialized for document refinement and formatting.
*   **Multi-View Interface**: Toggle between PDF, HTML, Code (Monaco), and Diff views.
*   **Zero Data Upload**: All processing happens locally in your browser for maximum privacy.

## 📚 Documentation

Guides are available to help you integrate and use the PDF Extractor:

*   **[Getting Started](docs/getting-started.md)**: Introduction to loading documents, switching views, and basic editing.
*   **[Comparison Tools](docs/comparison-tools.md)**: Guide to using Visual Diff and version comparison features.
*   **[API Reference](docs/API.md)**: (Optional) Technical documentation for the extraction engine and worker architecture.

## 🏁 Getting Started

### Requirements
*   A modern web browser (Chrome, Firefox, Safari, Edge).
*   No installation required for basic use.

### Setup and Running
1.  Navigate to the `tools/pdf-processor/` directory.
2.  Open `index.html` in your browser.
3.  Alternatively, use a local server:
    ```bash
    npx vite
    ```

## 📜 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

Copyright (c) 2026 GINEXYS
