const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
// NZ landline (0X-XXX-XXXX) and mobile (02X-XXX-XXXX[X]) numbers, spaced or hyphenated.
const NZ_PHONE_RE = /\b0\d(?:[ -]?\d){7,9}\b/g;

/**
 * Redacts PII that's safe to strip with regex alone (emails, phone numbers) from
 * text before it's sent to an external API.
 *
 * ponytail: person names and street addresses aren't redacted - reliably finding
 * them needs NER, not regex, and address fields are themselves target extraction
 * data here. Raw files and extracted JSON stay local-only (never committed) as
 * the compensating control. Upgrade path: run a local NER pass (e.g. a small
 * spaCy/compromise model) to mask names before any page image/text leaves the
 * process, if this ever needs to go further.
 */
export function redactText(text: string): string {
  return text.replace(EMAIL_RE, '[redacted-email]').replace(NZ_PHONE_RE, '[redacted-phone]');
}
