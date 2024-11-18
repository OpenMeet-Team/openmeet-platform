export function encodeNumberToLowercaseString (num: number): string {
  const base = 26 // Base for lowercase letters (a-z)
  let encodedString = ''

  // Adjust so 0 maps to 'a', 1 to 'b', ..., 25 to 'z'
  while (num >= 0) {
    const remainder = num % base
    encodedString = String.fromCharCode(remainder + 'a'.charCodeAt(0)) + encodedString
    num = Math.floor(num / base) - 1
    if (num < 0) break
  }

  return encodedString
}

export function decodeLowercaseStringToNumber (str: string): number {
  if (!str) return 0
  const base = 26
  let num = 0

  // Reverse loop through the string to convert it back to a number
  for (let i = 0; i < str.length; i++) {
    const charValue = str.charCodeAt(i) - 'a'.charCodeAt(0)
    num = num * base + charValue + 1
  }

  return num - 1
}
