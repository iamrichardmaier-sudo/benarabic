

# Fix Arabic Text in PDF Export

## The Problem
jsPDF uses Helvetica by default, which doesn't support Arabic characters. This causes the Arabic text to appear as garbled/disconnected characters in the exported PDF.

## The Solution
Embed an Arabic-compatible font (Amiri) as a base64 string and register it with jsPDF before generating the table. This is the standard approach recommended by jsPDF documentation and the community.

## What Will Change

**File: `src/components/DeckList.tsx`**

1. **Create a font loader**: Add a utility that fetches the Amiri font from Google Fonts CDN, converts it to base64, and registers it with jsPDF using `doc.addFileToVFS()` and `doc.addFont()`.

2. **Apply font to Arabic column**: Use jsPDF-autoTable's `didParseCell` callback to set the Amiri font specifically on the Arabic Word column (column index 1), while keeping Helvetica for everything else.

3. **Make export async**: Since loading the font from CDN is asynchronous, the `exportPDF` function will become `async` and show a brief loading state on the button while generating.

**New file: `src/lib/amiri-font.ts`**

A helper module that:
- Fetches the Amiri Regular TTF from Google Fonts CDN (`https://fonts.gstatic.com/s/amiri/...`)
- Converts the binary to a base64 string
- Caches the result so subsequent exports don't re-download
- Provides a function `registerAmiriFont(doc: jsPDF)` that registers the font on a jsPDF instance

## Technical Details

The key steps in code:
1. Fetch the TTF file as an ArrayBuffer
2. Convert to base64 string
3. Call `doc.addFileToVFS("Amiri-Regular.ttf", base64String)`
4. Call `doc.addFont("Amiri-Regular.ttf", "Amiri", "normal")`
5. In autoTable's `didParseCell`, set `data.cell.styles.font = "Amiri"` for column 1

This approach:
- Works entirely client-side (no backend needed)
- Caches the font after first download for fast repeat exports
- Only changes the PDF export code -- no impact on any other feature

