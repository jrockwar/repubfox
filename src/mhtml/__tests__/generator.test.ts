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

  // Basic character encoding test
  const mockDoc = {
    title: "Test Page with Special Characters: Don't Encode Me!",
    documentElement: {
      outerHTML: `
        <html>
          <head>
            <title>Test Page</title>
          </head>
          <body>
            <h1>Testing Special Characters</h1>
            <p>Here's a paragraph with an apostrophe and some dots...</p>
            <p>Special characters like = should be encoded</p>
            <p>Non-ASCII like é and ñ should be encoded</p>
            <p>Line breaks should
               be encoded properly</p>
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

  it('should properly handle special characters in MHTML generation', async () => {
    const result = await generateMHTML(mockDoc);
    const content = new TextDecoder().decode(result);
    
    // Check that apostrophes are not encoded
    expect(content).toContain("Here's");
    expect(content).not.toContain("Here=27s");
    
    // Check that dots are not encoded
    expect(content).toContain("...");
    expect(content).not.toContain("=2E=2E=2E");
    
    // Check that equals signs are encoded
    expect(content).toContain("=3D");
    
    // Check that non-ASCII characters are encoded
    expect(content).toContain("=E9"); // é
    expect(content).toContain("=F1"); // ñ
    
    // Check that line breaks are properly encoded
    expect(content).toContain("=0D=0A");
  });

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
                <h2>Key Developments in 2023</h2>
                <ul>
                  <li>GPT-4's impact on natural language processing</li>
                  <li>Breakthrough in protein folding prediction</li>
                  <li>Advanced robotics integration with AI</li>
                </ul>
                <p>
                  The field of AI ethics has also seen significant progress, with researchers 
                  tackling questions about bias, fairness, and transparency. Companies like 
                  DeepMind and OpenAI have implemented new guidelines for responsible AI development.
                </p>
                <figure>
                  <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=" alt="AI Development Timeline">
                  <figcaption>Fig.1 - AI Development Timeline (2020-2024)</figcaption>
                </figure>
              </article>
            </body>
          </html>
        `
      },
      location: {
        href: 'https://example.com/ai-revolution'
      },
      getElementsByTagName: () => createMockHTMLCollection(),
      styleSheets: createMockStyleSheetList()
    };

    const result = await generateMHTML(realWorldDoc);
    const content = new TextDecoder().decode(result);
    
    // Test proper handling of various content types
    expect(content).toContain("What's Next?"); // Apostrophes in title
    expect(content).toContain("O'Connor"); // Apostrophes in names
    
    // Test that non-ASCII characters are properly encoded in quoted-printable format
    // These will be decoded back to Unicode when parsing the MHTML for EPUB conversion
    const decodedContent = content.replace(/=([0-9A-F]{2})/g, (_, hex) => 
      String.fromCharCode(parseInt(hex, 16))
    );
    expect(decodedContent).toContain("María"); // Non-ASCII characters should decode correctly
    expect(decodedContent).toContain("González"); // Non-ASCII characters should decode correctly
    
    // Test structural elements
    expect(content).toContain('<blockquote>'); // HTML tags
    expect(content).toContain('class=3D"article"'); // CSS classes with encoded equals
    expect(content).toContain('max-width: 800px'); // CSS styles
    
    // Test proper MIME structure
    expect(content).toContain('Content-Type: multipart/related');
    expect(content).toContain('Content-Transfer-Encoding: quoted-printable');
    expect(content).toContain('MIME-Version: 1.0');
    
    // Test proper encoding of special characters in metadata
    expect(content).toContain('charset=3D"utf-8"'); // Encoded equals sign
    expect(content).not.toContain('charset="utf-8"'); // Raw equals sign should not exist
    
    // Verify line breaks are properly encoded
    const lineBreaks = content.match(/=0D=0A/g);
    expect(lineBreaks).toBeTruthy();
    expect(lineBreaks!.length).toBeGreaterThan(0);
  });
});
