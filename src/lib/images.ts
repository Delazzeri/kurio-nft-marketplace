/** Variante de 400 px gerada junto da imagem original (public/nfts/<nome>-400.webp). */
export function thumbnail(src: string) {
  return src.replace(/\.webp$/, '-400.webp')
}
