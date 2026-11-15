export function money(value: number | string | null | undefined, currency = "CRC") {
  return new Intl.NumberFormat("es-CR", { style: "currency", currency, currencyDisplay: "narrowSymbol" }).format(Number(value ?? 0));
}

export function when(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function day(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(new Date(value));
}
