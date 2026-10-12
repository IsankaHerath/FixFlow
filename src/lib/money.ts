/** Convert a decimal LKR entry to exact minor units without floating point. */
export function parseMoney(value: string): number {
  const input = value.trim();
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(input))
    throw new Error("Enter an LKR amount with up to two decimal places.");
  const [whole, fraction = ""] = input.split(".");
  const minor = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  if (minor > 2_000_000_000n)
    throw new Error("Amount exceeds the supported limit.");
  return Number(minor);
}
export const moneyInput = (minor: number) =>
  `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, "0")}`;
