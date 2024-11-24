import { generateMHTML } from '../generator';
import { describe, expect, it } from 'bun:test';

describe('MHTML Generator', () => {
  // Helper to create a mock HTML collection
  function createMockHTMLCollection(): HTMLCollectionOf<HTMLImageElement> {
    const collection = [] as unknown as HTMLCollectionOf<HTMLImageElement>;
    collection.item = (index: number) => collection[index] || null;
    collection.namedItem = (name: string) => {
      const found = Array.from(collection).find(item => item.id === name);
      return found || null;
    };
    return collection;
  }

  // Helper to create a mock StyleSheetList
  function createMockStyleSheetList(): StyleSheetList {
    const list = [] as unknown as StyleSheetList;
    list.item = (index: number) => list[index] || null;
    return list;
  }

  // Helper function to find and decode content between boundaries
  function extractAndDecode(content: string): string {
    const parts = content.split('--REPUBFOX-MHTML-BOUNDARY');
    const mainContent = parts[1]; // First part after header
    if (!mainContent) return '';
    
    // Find the actual content after the headers
    const contentStart = mainContent.indexOf('\r\n\r\n');
    if (contentStart === -1) return '';
    
    const encodedContent = mainContent.slice(contentStart + 4);
    
    // First split into lines and remove soft line breaks
    const lines = encodedContent.split('\r\n');
    let decoded = '';
    for (const line of lines) {
      if (!line) continue;
      if (line.endsWith('=')) {
        // Remove soft line break and continue to next line
        decoded += line.slice(0, -1);
      } else {
        decoded += line;
      }
    }

    // Now decode the quoted-printable sequences
    const bytes = new Uint8Array(
      decoded.split(/=([0-9A-F]{2})/g)
        .filter(part => part)
        .map(part => {
          if (part.length === 2) {
            return parseInt(part, 16);
          }
          return part.split('').map(c => c.charCodeAt(0));
        })
        .flat()
    );

    // Convert the bytes to a UTF-8 string
    return new TextDecoder('utf-8').decode(bytes);
  }

  describe('Character Encoding', () => {
    // Test document with various character encoding edge cases
    const mockDoc = {
      title: "Character Encoding Test: Don't break this!",
      documentElement: {
        outerHTML: `
          <html>
            <head>
              <title>Character Encoding Test</title>
            </head>
            <body>
              <h1>Testing RFC 2045 Quoted-Printable Encoding</h1>
              
              <!-- Test ASCII printable characters -->
              <p>Basic ASCII: The quick brown fox jumps over the lazy dog.</p>
              
              <!-- Test special characters that must be encoded -->
              <p>Special MIME chars: = (equals)</p>
              
              <!-- Test whitespace -->
              <p>Spaces and	tabs should be preserved</p>
              
              <!-- Test line endings -->
              <p>Line breaks should
                 be properly encoded</p>
              
              <!-- Test apostrophes and quotes -->
              <p>Don't break "quoted text" or 'single quotes'</p>
              
              <!-- Test non-ASCII characters -->
              <p>UTF-8: é (e-acute), ñ (n-tilde), 漢 (han), 🦊 (fox emoji)</p>
              
              <!-- Test HTML entities -->
              <p>&lt;brackets&gt; &amp; &quot;entities&quot;</p>
              
              <!-- Test long lines -->
              <p>${'a'.repeat(100)}</p>
            </body>
          </html>
        `
      },
      location: {
        href: 'https://example.com/test'
      },
      getElementsByTagName: () => createMockHTMLCollection(),
      styleSheets: createMockStyleSheetList()
    };

    it('should properly encode according to RFC 2045', async () => {
      const result = await generateMHTML(mockDoc);
      const content = new TextDecoder().decode(result);

      // Helper to check if a string appears in decoded form
      const containsWhenDecoded = (original: string) => {
        const decoded = extractAndDecode(content);
        expect(decoded).toContain(original);
      };

      // 1. ASCII printable characters (33-126) should not be encoded
      containsWhenDecoded('The quick brown fox jumps over the lazy dog');

      // 2. Special MIME characters must be encoded
      expect(content).toContain('=3D'); // equals sign

      // 3. Whitespace
      // - Space (32) and tab (9) can be as-is except at line end
      containsWhenDecoded('Spaces and\ttabs');

      // 4. Line endings must be =0D=0A
      expect(content).toContain('=0D=0A');

      // 5. Quotes and apostrophes (printable ASCII) should not be encoded
      containsWhenDecoded('Don\'t');
      containsWhenDecoded('"quoted text"');
      containsWhenDecoded('\'single quotes\'');

      // 6. Non-ASCII characters must be encoded
      expect(content).toContain('=C3=A9');  // é (UTF-8 encoded)
      expect(content).toContain('=C3=B1');  // ñ (UTF-8 encoded)
      expect(content).toMatch(/=E6=BC=A2/); // 漢 (UTF-8 encoded)
      containsWhenDecoded('🦊'); // fox emoji - check the decoded content instead

      // 7. HTML entities should be preserved as-is
      containsWhenDecoded('&lt;brackets&gt;');
      containsWhenDecoded('&amp;');
      containsWhenDecoded('&quot;entities&quot;');

      // 8. Long lines should be properly wrapped
      const longLine = 'a'.repeat(100);
      // The line should be split into multiple lines with = continuation
      const lines = content.split('\r\n');
      // Find the line containing our long string of 'a's
      const contentLines = lines.filter(line => 
        line.includes('aaaaaaaaaaaa') // Look for a sequence of 'a's
      );
      expect(contentLines.length).toBeGreaterThan(1); // Should be split into multiple lines
      // All but the last line should end with = for soft line breaks
      expect(contentLines.slice(0, -1).every(line => line.endsWith('='))).toBe(true);
      // Each line should be <= 76 chars
      expect(contentLines.every(line => line.length <= 76)).toBe(true);
    });
  });

  // Keep the real-world article test as it provides good coverage for practical scenarios
  it('should handle real-world article content correctly', async () => {
    const realWorldDoc = {
      title: "The AI Revolution: What's Next?",
      documentElement: {
        outerHTML: `
          <html>
            <head>
              <title>The AI Revolution: What's Next?</title>
              <meta charset="utf-8">
              <style>
                body { font-family: 'Arial', sans-serif; }
                .article { max-width: 800px; margin: 0 auto; }
                blockquote { border-left: 3px solid #ccc; padding-left: 1em; }
              </style>
            </head>
            <body>
              <article class="article">
                <h1>The AI Revolution: What's Next?</h1>
                <div class="metadata">
                  By Sarah O'Connor | Published: January 15th, 2024
                </div>
                <p>
                  As we enter 2024, artificial intelligence continues to reshape our world. 
                  Let's explore what's on the horizon...
                </p>
                <blockquote>
                  "AI isn't just about automation — it's about augmentation of human capabilities"
                  — Dr. María González
                </blockquote>
              </article>
            </body>
          </html>
        `
      },
      location: {
        href: 'https://example.com/article'
      },
      getElementsByTagName: () => createMockHTMLCollection(),
      styleSheets: createMockStyleSheetList()
    };

    const result = await generateMHTML(realWorldDoc);
    const content = new TextDecoder().decode(result);

    // Check that the content is properly encoded and can be decoded
    const decoded = extractAndDecode(content);

    // Title should be preserved
    expect(decoded).toContain("The AI Revolution: What's Next?");

    // Author name with apostrophe should be correct
    expect(decoded).toContain("Sarah O'Connor");

    // Non-ASCII name should be preserved after decoding
    expect(decoded).toContain("María González");

    // Em dash should be properly encoded and decoded
    expect(decoded).toContain("—");

    // CSS should be preserved
    expect(decoded).toContain("font-family: 'Arial'");
  });
});
