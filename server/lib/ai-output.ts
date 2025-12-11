import sanitizeHtml from "sanitize-html";

export function stripMarkdownCodeFences(content: string): string {
  if (!content) return "";

  let result = content.trim();

  const backtickFencePattern = /^[ \t]*```[ \t]*[\w.+#_{}()-]*\s*$/gim;
  result = result.replace(backtickFencePattern, "");

  const tildeFencePattern = /^[ \t]*~~~[ \t]*[\w.+#_{}()-]*\s*$/gim;
  result = result.replace(tildeFencePattern, "");

  return result.trim();
}

export function sanitizeModelHtml(rawOutput: string): string {
  if (!rawOutput) return "";

  let html = stripMarkdownCodeFences(rawOutput);

  html = html.replace(/^\s*[\r\n]+/, "");
  html = html.replace(/[\r\n]+\s*$/, "");

  // Sanitize HTML to prevent XSS attacks from AI-generated content
  // Allow common formatting tags but remove dangerous attributes and scripts
  html = sanitizeHtml(html, {
    allowedTags: [
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "p",
      "br",
      "hr",
      "strong",
      "em",
      "u",
      "s",
      "sup",
      "sub",
      "ul",
      "ol",
      "li",
      "blockquote",
      "pre",
      "code",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "a",
      "img",
      "div",
      "span",
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title", "width", "height"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan"],
      "*": ["class"], // Allow class attribute for styling
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: {
      a: ["http", "https", "mailto"],
      img: ["http", "https", "data"], // Allow data URIs for images
    },
    // Transform links to open in new tab and add noopener
    transformTags: {
      a: (tagName, attribs) => {
        return {
          tagName: "a",
          attribs: {
            ...attribs,
            target: "_blank",
            rel: "noopener noreferrer",
          },
        };
      },
    },
    // Remove any potentially dangerous HTML5 attributes
    nonBooleanAttributes: [
      "abbr",
      "accept",
      "accept-charset",
      "accesskey",
      "action",
      "allow",
      "alt",
      "as",
      "autocapitalize",
      "autocomplete",
      "charset",
      "cite",
      "class",
      "cols",
      "colspan",
      "content",
      "coords",
      "crossorigin",
      "data",
      "datetime",
      "decoding",
      "dir",
      "dirname",
      "download",
      "enctype",
      "enterkeyhint",
      "for",
      "form",
      "formaction",
      "formenctype",
      "formmethod",
      "formtarget",
      "headers",
      "height",
      "href",
      "hreflang",
      "http-equiv",
      "id",
      "imagesizes",
      "imagesrcset",
      "inputmode",
      "integrity",
      "is",
      "itemid",
      "itemprop",
      "itemref",
      "itemtype",
      "kind",
      "label",
      "lang",
      "list",
      "loading",
      "max",
      "maxlength",
      "media",
      "method",
      "min",
      "minlength",
      "name",
      "pattern",
      "ping",
      "placeholder",
      "poster",
      "preload",
      "referrerpolicy",
      "rel",
      "rows",
      "rowspan",
      "sandbox",
      "scope",
      "shape",
      "size",
      "sizes",
      "slot",
      "span",
      "spellcheck",
      "src",
      "srcdoc",
      "srclang",
      "srcset",
      "start",
      "step",
      "style",
      "tabindex",
      "target",
      "title",
      "translate",
      "type",
      "usemap",
      "value",
      "width",
      "wrap",
    ],
  });

  return html;
}
