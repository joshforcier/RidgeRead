import type { PinIconKind } from '@/types/userPin'

export function userPinIconSvg(kind: PinIconKind, className: string, style = ''): string {
  const styleAttr = style ? ` style="${style}"` : ''
  const open = `<svg class="${className}"${styleAttr} viewBox="0 0 24 24" aria-hidden="true">`
  const close = '</svg>'

  switch (kind) {
    case 'elk-antlers':
      return `${open}
        <path d="M12 20v-6" />
        <path d="M12 14c-2.6-1.2-4.5-3.8-5.2-6.8" />
        <path d="M6.8 7.2 4.6 5" />
        <path d="M7.4 9.7H4.2" />
        <path d="M8.8 12.2 6.2 14.3" />
        <path d="M12 14c2.6-1.2 4.5-3.8 5.2-6.8" />
        <path d="M17.2 7.2 19.4 5" />
        <path d="M16.6 9.7h3.2" />
        <path d="M15.2 12.2l2.6 2.1" />
        <path d="M10 20h4" />
      ${close}`
    case 'binoculars':
      return `${open}
        <path d="M7.5 8.5 9 5.5h2l1 3" />
        <path d="M16.5 8.5 15 5.5h-2l-1 3" />
        <path d="M5.5 9.5h5v7h-5z" />
        <path d="M13.5 9.5h5v7h-5z" />
        <path d="M10.5 12h3" />
        <path d="M6.8 16.5c0 1.1.9 2 2 2s2-.9 2-2" />
        <path d="M13.2 16.5c0 1.1.9 2 2 2s2-.9 2-2" />
      ${close}`
    case 'tree-stand':
      return `${open}
        <path d="M7 20V8" />
        <path d="M11 20V8" />
        <path d="M7 11h4" />
        <path d="M7 15h4" />
        <path d="M12 8h6" />
        <path d="M17 8v4" />
        <path d="M13.5 12h5" />
        <path d="M5 20h9" />
      ${close}`
    case 'wall-tent':
      return `${open}
        <path d="M3.5 18h17" />
        <path d="M5 18 12 6l7 12" />
        <path d="M12 6v12" />
        <path d="M8.5 18 12 12l3.5 6" />
        <path d="M5 18l-1.5 2" />
        <path d="M19 18l1.5 2" />
      ${close}`
    case 'trail-camera':
      return `${open}
        <path d="M7 5h10a2 2 0 0 1 2 2v11H5V7a2 2 0 0 1 2-2Z" />
        <path d="M9 5V3.5h6V5" />
        <path d="M8 9h3" />
        <circle cx="13" cy="13" r="3" />
        <path d="M18 9h1.8" />
        <path d="M7.5 18v2" />
        <path d="M16.5 18v2" />
      ${close}`
    case 'tracks':
      return `${open}
        <path d="M8.3 5.8c1.2 1.2 1.5 3.2.6 4.4-.9 1.2-2.7 1.1-4-.1-1.2-1.2-1.5-3.2-.6-4.4.9-1.2 2.7-1.1 4 .1Z" />
        <path d="M15.7 13.8c1.2 1.2 1.5 3.2.6 4.4-.9 1.2-2.7 1.1-4-.1-1.2-1.2-1.5-3.2-.6-4.4.9-1.2 2.7-1.1 4 .1Z" />
        <path d="M11.5 4.5c.8.3 1.2 1.2.9 2" />
        <path d="M4.2 13.4c.8.3 1.2 1.2.9 2" />
        <path d="M18.9 9c.8.3 1.2 1.2.9 2" />
      ${close}`
    case 'blood-drop':
      return `${open}
        <path d="M12 3.5c3.2 4 5.2 7 5.2 10a5.2 5.2 0 0 1-10.4 0c0-3 2-6 5.2-10Z" />
        <path d="M9.8 15.8c.7.8 1.5 1.2 2.6 1.2" />
        <path d="M6 5.5 4.5 4" />
        <path d="M18 5.5 19.5 4" />
      ${close}`
    case 'access-gate':
      return `${open}
        <path d="M5 20V5" />
        <path d="M19 20V5" />
        <path d="M5 8h14" />
        <path d="M5 14h14" />
        <path d="M8 8v6" />
        <path d="M16 8v6" />
        <path d="M10 20h4" />
      ${close}`
    case 'field-note':
      return `${open}
        <path d="M7 4.5h9.5A2.5 2.5 0 0 1 19 7v12.5H7A2 2 0 0 1 5 17.5v-11a2 2 0 0 1 2-2Z" />
        <path d="M8.5 8h7" />
        <path d="M8.5 11.5h6" />
        <path d="M8.5 15h3.5" />
        <path d="M5 17.5c0-1.1.9-2 2-2h12" />
      ${close}`
  }

  return ''
}