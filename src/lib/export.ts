import { strToU8, zipSync } from 'fflate'

export type Cell = string | number | null | undefined

/** Stops spreadsheet programs from running a note that starts with = + - or @ as a formula. */
function safe(v: string): string {
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v
}

export function toCsv(rows: Cell[][]): string {
  const line = (r: Cell[]) =>
    r
      .map((c) => {
        const s = c == null ? '' : typeof c === 'number' ? String(c) : safe(c)
        return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
      })
      .join(',')
  // the BOM makes Excel read the file as UTF-8
  return '\uFEFF' + rows.map(line).join('\r\n') + '\r\n'
}

const xml = (s: string) =>
  s
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** A minimal OpenDocument spreadsheet (.ods) with one sheet per entry. */
export function toOds(sheets: { name: string; rows: Cell[][] }[]): Uint8Array<ArrayBuffer> {  const cell = (c: Cell) =>
    typeof c === 'number'
      ? `<table:table-cell office:value-type="float" office:value="${c}"/>`
      : c == null || c === ''
        ? '<table:table-cell/>'
        : `<table:table-cell office:value-type="string"><text:p>${xml(c)}</text:p></table:table-cell>`
  const body = sheets
    .map((s) => `<table:table table:name="${xml(s.name)}">${s.rows.map((r) => `<table:table-row>${r.map(cell).join('')}</table:table-row>`).join('')}</table:table>`)
    .join('')
  const content =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" ' +
    'xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" ' +
    'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" office:version="1.2">' +
    `<office:body><office:spreadsheet>${body}</office:spreadsheet></office:body></office:document-content>`
  const manifest =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">' +
    '<manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.spreadsheet"/>' +
    '<manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>' +
    '</manifest:manifest>'
  // "mimetype" must be the first entry and stored uncompressed
  const zipped = zipSync({
    mimetype: [strToU8('application/vnd.oasis.opendocument.spreadsheet'), { level: 0 }],
    'META-INF/manifest.xml': strToU8(manifest),
    'content.xml': strToU8(content),
  })
  // copy into a plain ArrayBuffer-backed array so it is a valid BlobPart
  return new Uint8Array(zipped)
}

export function download(name: string, data: BlobPart, type: string): void {
  const url = URL.createObjectURL(new Blob([data], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}