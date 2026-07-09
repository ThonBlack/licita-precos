const DIACRITICOS = /[̀-ͯ]/g

/** Normaliza texto para matching: minúsculas, sem acentos, sem pontuação, espaços colapsados. */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(DIACRITICOS, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}
