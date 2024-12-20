/**
 * Simplified MHTML generator based on SingleFile's core functionality
 */

// MIME boundary for MHTML parts
const BOUNDARY = 'REPUBFOX-MHTML-BOUNDARY';

interface Resource {
  url: string;
  content: string;
  contentType: string;
}

interface MHTMLDocument {
  title: string;
  documentElement: {
    outerHTML: string;
  };
  location: {
    href: string;
  };
  getElementsByTagName(tagName: string): HTMLCollectionOf<HTMLImageElement>;
  styleSheets: StyleSheetList;
}

/**
 * Creates an MHTML document from HTML content and its resources
 */
export async function generateMHTML(doc: MHTMLDocument): Promise<Uint8Array> {
  try {
    console.log('[generator] Starting MHTML generation');
    // Get all resources (images, styles, etc.)
    const resources = await collectResources(doc);
    console.log('[generator] Collected resources:', resources.length);
    
    // Create MHTML parts
    const header = createMHTMLHeader(doc);
    console.log('[generator] Created header:', header);
    
    const mainContent = createMainContent(doc);
    console.log('[generator] Main content length:', mainContent.length);
    
    const resourceParts = resources.map(createResourcePart);
    console.log('[generator] Resource parts:', resourceParts.length);

    // Join all parts with boundary, ensuring proper spacing
    const parts = [
      header,
      `--${BOUNDARY}\r\n${mainContent}`,
      ...resourceParts.map(part => `--${BOUNDARY}\r\n${part}`),
      `--${BOUNDARY}--\r\n`  // Termination boundary must end with CRLF
    ];
    
    const mhtmlContent = parts.join('\r\n');
    console.log('[generator] MHTML structure (first 500 chars):', mhtmlContent.substring(0, 500));
    
    // Convert to Uint8Array
    const encoder = new TextEncoder();
    return encoder.encode(mhtmlContent);
  } catch (error) {
    console.error('[generator] Error generating MHTML:', error);
    throw error;
  }
}

/**
 * Creates the MHTML header part
 */
function createMHTMLHeader(doc: MHTMLDocument): string {
  const contentLocation = doc.location.href;
  const header = [
    'From: Saved by RepubFox',
    'Subject: ' + doc.title,
    'Date: ' + new Date().toUTCString(),
    'MIME-Version: 1.0',
    `Content-Type: multipart/related; boundary="${BOUNDARY}"`,
    'Snapshot-Content-Location: ' + contentLocation,
  ].join('\r\n');  // Use CRLF for header lines
  
  console.log('[generator] Header created:', header);
  return header + '\r\n\r\n';  // Add two CRLF sequences for the blank line
}

/**
 * Encodes text as quoted-printable, preserving HTML special characters
 * This version uses a custom encoding for apostrophes to avoid mhtml-stream decoding issues
 */
function encodeQuotedPrintable(text: string): string {
  console.log('[generator] Original text sample (first 1000 chars):', text.slice(0, 1000));
  
  // First normalize all line endings to CRLF
  const normalized = text.replace(/\r\n|\n|\r/g, '\r\n');
  
  // Convert to bytes to handle non-ASCII characters correctly
  const encoder = new TextEncoder();
  const bytes = encoder.encode(normalized);
  
  // Convert each byte to its appropriate representation
  let encoded = '';
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    if (byte === undefined) continue; // Skip undefined bytes
    
    // RFC 2045 specifies:
    // - Only printable ASCII characters (33-126) can be represented as-is
    // - Space (32) and tab (9) can be represented as-is, except at line endings
    // - CR (13) and LF (10) must be encoded
    // - All other bytes must be encoded
    if ((byte >= 33 && byte <= 126 && byte !== 61) || // printable ASCII except =
        (byte === 32 && i + 1 < bytes.length && bytes[i + 1] !== 13 && bytes[i + 1] !== 10) || // space not before CR/LF
        (byte === 9 && i + 1 < bytes.length && bytes[i + 1] !== 13 && bytes[i + 1] !== 10)) {  // tab not before CR/LF
      encoded += String.fromCharCode(byte);
    } else {
      encoded += '=' + byte.toString(16).toUpperCase().padStart(2, '0');
    }
  }

  // RFC 2045 requires lines to be no longer than 76 characters
  // We need to wrap lines, being careful not to break encoded sequences
  const MAX_LINE_LENGTH = 76;
  const wrappedLines: string[] = [];
  let currentLine = '';

  for (let i = 0; i < encoded.length;) {
    // If we're at the start of an encoded sequence (=XX)
    if (encoded[i] === '=' && i + 2 < encoded.length) {
      const sequence = encoded.slice(i, i + 3);
      // If the sequence would cross line boundary, wrap first
      if (currentLine.length >= MAX_LINE_LENGTH - sequence.length) {
        wrappedLines.push(currentLine + '=');
        currentLine = '';
        continue;
      }
      currentLine += sequence;
      i += 3;
      continue;
    }

    // For normal characters
    if (currentLine.length >= MAX_LINE_LENGTH - 1) {
      wrappedLines.push(currentLine + '=');
      currentLine = '';
      continue;
    }
    
    currentLine += encoded[i];
    i++;
  }

  // Add the last line if any
  if (currentLine) {
    wrappedLines.push(currentLine);
  }

  const result = wrappedLines.join('\r\n');
  console.log('[generator] Encoded text sample (first 1000 chars):', result.slice(0, 1000));
  return result;
}

/**
 * Creates the main content part containing the HTML
 */
function createMainContent(doc: MHTMLDocument): string {
  const contentLocation = doc.location.href;
  
  // Create a complete HTML document with location meta tag
  const locationMeta = `<meta name="mhtml-location" content="${contentLocation}">`;
  const baseTag = `<base href="${contentLocation}">`;
  let content = doc.documentElement.outerHTML;
  
  // Ensure we have a head tag
  if (!content.includes('<head')) {
    content = content.replace('<html', '<html><head></head>');
  }
  
  // Add our meta tags
  content = content.replace(/<head[^>]*>/, `$&${locationMeta}${baseTag}`);
  
  // Ensure proper DOCTYPE and structure
  content = `<!DOCTYPE html>\n${content}`;

  // Encode content as quoted-printable
  const encodedContent = encodeQuotedPrintable(content);

  // Headers must match exactly what the parser expects
  const mainContent = [
    'Content-Type: text/html; charset=UTF-8',  // Must be exactly "text/html" for the parser
    'Content-Transfer-Encoding: quoted-printable',
    'Content-Location: ' + contentLocation,
    '',  // Empty line before content
    encodedContent
  ].join('\r\n');
  
  console.log('[generator] Main content created with Content-Type: text/html');
  console.log('[generator] Content length:', encodedContent.length);
  return mainContent;
}

/**
 * Creates a resource part (images, styles, etc.)
 */
function createResourcePart(resource: Resource): string {
  // Ensure proper content type formatting
  const contentType = resource.contentType.includes('charset=') 
    ? resource.contentType 
    : `${resource.contentType}; charset=utf-8`;

  const part = [
    `Content-Type: ${contentType}`,
    'Content-Transfer-Encoding: base64',
    'Content-Location: ' + resource.url,
    '',  // Empty line before content
    resource.content
  ].join('\r\n');
  
  console.log('[generator] Resource part created for:', resource.url);
  return part;
}

/**
 * Collects all resources from the document
 */
async function collectResources(doc: MHTMLDocument): Promise<Resource[]> {
  const resources: Resource[] = [];
  const processedUrls = new Set<string>();

  // Process images
  const images = doc.getElementsByTagName('img');
  for (const img of images) {
    const url = img.src;
    if (url && !url.startsWith('data:') && !processedUrls.has(url)) {
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        const base64Content = await blobToBase64(blob);
        const content = base64Content.split(',')[1];
        
        if (content) {
          resources.push({
            url,
            content,
            contentType: blob.type || 'application/octet-stream',
          });
          
          processedUrls.add(url);
        }
      } catch (error) {
        console.warn(`Failed to fetch image: ${url}`, error);
      }
    }
  }

  // Process stylesheets
  const styleSheets = doc.styleSheets;
  for (const sheet of styleSheets) {
    if (sheet.href && !processedUrls.has(sheet.href)) {
      try {
        const response = await fetch(sheet.href);
        const text = await response.text();
        
        resources.push({
          url: sheet.href,
          content: btoa(text),
          contentType: 'text/css',
        });
        
        processedUrls.add(sheet.href);
      } catch (error) {
        console.warn(`Failed to fetch stylesheet: ${sheet.href}`, error);
      }
    }
  }

  return resources;
}

/**
 * Converts a Blob to base64 string
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
