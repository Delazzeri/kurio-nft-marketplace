import Big from 'big.js'

/**
 * Valores em ETH trafegam como strings decimais e nunca passam por `number`.
 * Toda aritmética usa big.js para não perder precisão (ex.: 0.1 + 0.2).
 */
Big.DP = 18
Big.RM = Big.roundHalfEven

export type EthString = string

export const eth = (value: EthString | number | Big) => new Big(value)

export function addEth(...values: EthString[]): EthString {
  return values.reduce((acc, v) => acc.plus(v), new Big(0)).toString()
}

export function mulEth(value: EthString, quantity: number): EthString {
  return new Big(value).times(quantity).toString()
}

export function subEth(a: EthString, b: EthString): EthString {
  return new Big(a).minus(b).toString()
}

export function compareEth(a: EthString, b: EthString): -1 | 0 | 1 {
  return new Big(a).cmp(b) as -1 | 0 | 1
}

/** Formata para exibição: mínimo de 2 casas, sem arredondar casas significativas (até 6). */
export function formatEth(value: EthString, { suffix = true }: { suffix?: boolean } = {}): string {
  const big = new Big(value)
  let text = big.toFixed(6).replace(/0+$/, '')
  const [int = '0', dec = ''] = text.split('.')
  text = `${int}.${dec.padEnd(2, '0')}`
  return suffix ? `${text} ETH` : text
}
