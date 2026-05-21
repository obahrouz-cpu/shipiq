// Formats a stored phone number for display, always prefixed with the
// Iraq country code (+964). Accepts values stored with or without the
// 964 prefix or a leading 0, and groups the local digits for readability.
export function displayPhone(phone?: string | null, fallback = ''): string {
  if (!phone) return fallback
  let digits = phone.replace(/\D/g, '')
  if (digits.startsWith('964')) digits = digits.slice(3)
  if (digits.startsWith('0'))   digits = digits.slice(1)
  if (!digits) return fallback

  let local: string
  if (digits.length <= 3)      local = digits
  else if (digits.length <= 6) local = `${digits.slice(0, 3)} ${digits.slice(3)}`
  else                         local = `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`

  return `+964 ${local}`
}
