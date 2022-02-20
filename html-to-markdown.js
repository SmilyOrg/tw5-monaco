import { NodeHtmlMarkdown } from 'node-html-markdown'
import * as fs from 'fs'

const markdown = NodeHtmlMarkdown.translate(
  fs.readFileSync(process.stdin.fd, { encoding: "utf-8" }),
  /* options (optional) */ {}, 
  /* customTranslators (optional) */ undefined,
  /* customCodeBlockTranslators (optional) */ undefined
);
process.stdout.write(markdown);
