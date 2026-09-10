/**
 * Thai Kedmanee (TIS 820-2531) to English US QWERTY keyboard mapping
 * Used to automatically correct text typed when the user forgot to switch keyboard layout.
 */
export const EN_TH_KEYB_PAIRS: Record<string, string> = {
  Z: "(",
  z: "ผ",
  X: ")",
  x: "ป",
  C: "ฉ",
  c: "แ",
  V: "ฮ",
  v: "อ",
  B: "\u0e3a", // พินทุ (ฺ)
  b: "\u0e34", // สระอิ (ิ)
  N: "\u0e4c", // การันต์ (์)
  n: "\u0e37", // สระอือ (ื)
  M: "?",
  m: "ท",
  "<": "ฒ",
  ",": "ม",
  ">": "ฬ",
  ".": "ใ",
  "?": "ฦ",
  "/": "ฝ",
  A: "ฤ",
  a: "ฟ",
  S: "ฆ",
  s: "ห",
  D: "ฏ",
  d: "ก",
  F: "โ",
  f: "ด",
  G: "ฌ",
  g: "เ",
  H: "\u0e47", // ไม้ไต่คู้ (็)
  h: "\u0e49", // ไม้โท (้)
  J: "\u0e4b", // ไม้จัตวา (๋)
  j: "\u0e48", // ไม้เอก (่)
  K: "ษ",
  k: "า",
  L: "ศ",
  l: "ส",
  ":": "ซ",
  ";": "ว",
  '"': ".",
  "'": "ง",
  Q: "๐",
  q: "ๆ",
  W: '"',
  w: "ไ",
  E: "ฎ",
  e: "\u0e33", // สระอำ (ำ)
  R: "ฑ",
  r: "พ",
  T: "ธ",
  t: "ะ",
  Y: "\u0e4d", // นิคหิต (ํ)
  y: "\u0e31", // ไม้หันอากาศ (ั)
  U: "\u0e4a", // ไม้ตรี (๊)
  u: "\u0e35", // สระอี (ี)
  I: "ณ",
  i: "ร",
  O: "ฯ",
  o: "น",
  P: "ญ",
  p: "ย",
  "{": "ฐ",
  "[": "บ",
  "}": ",",
  "]": "ล",
  "|": "ฅ",
  "\\": "ฃ",
  "~": "%",
  "`": "_",
  "!": "+",
  "1": "ๅ",
  "@": "๑",
  "2": "/",
  "#": "๒",
  "3": "-",
  "$": "๓",
  "4": "ภ",
  "%": "๔",
  "5": "ถ",
  "^": "\u0e39", // สระอู (ู)
  "6": "\u0e38", // สระอุ (ุ)
  "&": "฿",
  "7": "\u0e36", // สระอึ (ึ)
  "*": "๕",
  "8": "ค",
  "(": "๖",
  "9": "ต",
  ")": "๗",
  "0": "จ",
  _: "๘",
  "-": "ข",
  "+": "๙",
  "=": "ช",
};

export const TH_EN_KEYB_PAIRS: Record<string, string> = Object.fromEntries(
  Object.entries(EN_TH_KEYB_PAIRS).map(([en, th]) => [th, en])
);

/**
 * Returns true if the string contains any Thai unicode character.
 */
export function hasThaiChar(text: string): boolean {
  return /[\u0E00-\u0E7F]/.test(text);
}

/**
 * Converts Thai Kedmanee characters to US English QWERTY equivalents.
 * Only translates characters within Thai Unicode range (\u0E00-\u0E7F)
 * to preserve ASCII characters (like hyphens, slashes, numbers).
 */
export function convertThaiToEnglishKey(text: string): string {
  if (!hasThaiChar(text)) return text;
  let result = "";
  for (const char of text) {
    if (char >= "\u0E00" && char <= "\u0E7F") {
      result += TH_EN_KEYB_PAIRS[char] ?? char;
    } else {
      result += char;
    }
  }
  return result;
}

/**
 * Capitalizes the first letter of a string.
 */
export function capitalizeFirstLetter(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Formats a type input:
 * 1. Converts Thai Kedmanee layout keystrokes to English QWERTY
 * 2. Ensures the first letter is capitalized (e.g. ผฟิิรป -> zabbix -> Zabbix)
 */
export function formatTypeInput(text: string): string {
  if (!text) return text;
  const converted = convertThaiToEnglishKey(text);
  return capitalizeFirstLetter(converted);
}
