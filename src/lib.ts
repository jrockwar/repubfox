import { alter, closeMatch, exactMatch } from "./alter";
import { ImageData, ImageMime, epub } from "./epub";
import { EpubOptions } from "./options";
import { parse } from "./parse";

const remarkableCss = `
p {
  margin-top: 1em;
  margin-bottom: 1em;
}

ul, ol {
  padding: 1em;
}

ul li, ol li {
  margin-left: 1.5em;
  padding-left: 0.5em;
}

figcaption {
  font-size: 0.5rem;
  font-style: italic;
}`;

interface RawImageData {
  readonly data: Uint8Array;
  readonly mime: `image/${string}`;
}

interface Brighten {
  (
    buffer: Uint8Array,
    mime: string,
    brightness: number,
  ): Promise<readonly [Uint8Array, ImageMime]>;
}

interface Result {
  initial: string;
  altered: string;
  images: Map<string, RawImageData>;
  brightened: Map<string, ImageData>;
  epub: Uint8Array;
  title?: string;
}

function startsWithNarrow<const T extends string>(
  inp: string,
  prefix: T,
): inp is `${T}${string}` {
  return inp.startsWith(prefix);
}

export async function generate(
  mhtml: Uint8Array,
  brighten: Brighten,
  {
    imageHrefSimilarityThreshold,
    imageHandling,
    imageBrightness,
    filterLinks,
    rmCss,
    hrefHeader,
    bylineHeader,
    coverHeader,
  }: EpubOptions,
): Promise<Result> {
  const { href, content, assets } = await parse(mhtml);
  const parser = new DOMParser();
  const doc = parser.parseFromString(content, "text/html");

  const images = new Map<string, RawImageData>();
  for await (const { href, content: data, contentType } of assets) {
    if (startsWithNarrow(contentType, "image/")) {
      images.set(href, { mime: contentType, data });
    }
  }

  const matcher =
    imageHrefSimilarityThreshold > 0
      ? closeMatch(images, imageHrefSimilarityThreshold)
      : exactMatch(images);
  const { altered, title, byline, cover, seen } = alter(doc, matcher, {
    filterLinks,
    imageHandling,
    summarizeCharThreshold: 0,
  });

  if (cover && coverHeader) {
    seen.add(cover);
  }

  const proms = [];
  for (const href of seen) {
    const { mime, data } = images.get(href)!;
    proms.push(
      brighten(data, mime, imageBrightness).then(
        ([data, mime]) => [href, data, mime] as const,
        (err) => {
          console.warn(`problem brightening ${href}:`, err);
          return null;
        },
      ),
    );
  }

  const brightened = new Map<string, ImageData>();
  for (const res of await Promise.all(proms)) {
    if (res) {
      const [href, data, mime] = res;
      brightened.set(href, { data, mime });
    }
  }

  const buffer = await epub({
    title,
    content: altered,
    author: byline,
    images: brightened,
    css: rmCss ? remarkableCss : undefined,
    href: hrefHeader ? href : undefined,
    byline: bylineHeader,
    cover: coverHeader ? cover : undefined,
  });
  return { epub: buffer, title, initial: content, altered, brightened, images };
}