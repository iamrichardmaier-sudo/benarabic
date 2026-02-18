

# Fix PDF Export: Arabic Font Loading

## The Problem
The Amiri font URL from Google Fonts (`fonts.gstatic.com`) serves a compressed/subset version of the font that is missing the unicode cmap table. jsPDF requires a full, unmodified TTF file to register fonts properly, which causes the "No unicode cmap for font" error and the PDF export to fail entirely.

## The Fix
Change the font URL in `src/lib/amiri-font.ts` to point to the **full Amiri TTF** from the official GitHub repository, which includes all required font tables.

**File: `src/lib/amiri-font.ts`**

Replace the Google Fonts URL:
```
https://fonts.gstatic.com/s/amiri/v27/J7aRnpd8CGxBHqUrtA.ttf
```

With the full TTF from GitHub:
```
https://github.com/aliftype/amiri/releases/download/1.000/Amiri-Regular.ttf
```

This is a one-line change. Everything else (the base64 conversion, caching, font registration, and the PDF table configuration in DeckList.tsx) stays exactly the same.

