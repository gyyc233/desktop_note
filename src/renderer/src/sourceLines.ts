import type { Root, Element } from 'hast'

// Keep Markdown source positions on rendered blocks for bidirectional scrolling.
export function sourceLines() {
  return (tree: Root) => {
    const visit = (node: Root | Element) => {
      if (node.type === 'element' && /^(p|h[1-6]|pre|table|blockquote|li|hr)$/.test(node.tagName) && node.position) {
        node.properties['data-source-line'] = node.position.start.line
      }
      for (const child of node.children) if (child.type === 'element') visit(child)
    }
    visit(tree)
  }
}
