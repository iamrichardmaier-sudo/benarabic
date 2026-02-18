import jsPDF from 'jspdf';

let cachedBase64: string | null = null;

async function fetchAmiriFont(): Promise<string> {
  if (cachedBase64) return cachedBase64;

  const response = await fetch(
    'https://github.com/aliftype/amiri/releases/download/1.000/Amiri-Regular.ttf'
  );
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  cachedBase64 = btoa(binary);
  return cachedBase64;
}

export async function registerAmiriFont(doc: jsPDF): Promise<void> {
  const base64 = await fetchAmiriFont();
  doc.addFileToVFS('Amiri-Regular.ttf', base64);
  doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
}
