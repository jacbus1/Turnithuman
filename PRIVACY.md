# Privacy

Turnithuman is a static, browser-only application. It has no application server, account system, database, analytics SDK, or advertising SDK.

## What leaves the browser

- The website downloads its HTML, CSS, JavaScript, WebAssembly, and other static assets from GitHub Pages.
- On first analysis, the browser downloads the public q4 model and tokenizer from `huggingface.co`. The browser may cache these files for later use.
- GitHub Pages and Hugging Face may receive ordinary connection metadata such as an IP address and user agent under their own privacy policies.

The writing pasted or extracted from a document is passed directly to a Web Worker and is not included in model download requests. Turnithuman does not transmit, log, or persist that writing. Refreshing the page clears the workspace; clearing browser storage removes cached application/model data.

## Documents

TXT, Markdown, DOCX, text-layer PDF, and PPTX files are parsed locally. Files are not uploaded. Encrypted, damaged, scanned, or textless files are rejected instead of being sent elsewhere for processing.

## Verification

You can confirm the behavior in browser developer tools: after the page assets and model files load, analysis does not issue a request containing the submitted text.
