import { Pipe, PipeTransform } from '@angular/core';

// These patterns are kept in sync with messaging.service.ts maskSensitiveContent()
const PHONE_PATTERN = /(\+?\d[\d\s\-(). ]{7,}\d)/g;
const EMAIL_PATTERN = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

export function maskContent(value: string): string {
  return value
    .replace(PHONE_PATTERN, '[PHONE REDACTED]')
    .replace(EMAIL_PATTERN, '[EMAIL REDACTED]');
}

/**
 * MaskPipe — redacts phone numbers and email addresses.
 *
 * Applied in templates wherever message body text is rendered.
 * Usage:  {{ message.body | mask }}
 *
 * Patterns (per CLAUDE.md spec):
 *   Phone: /(\+?\d[\d\s\-().]{7,}\d)/g
 *   Email: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g
 */
@Pipe({
  name: 'mask',
  standalone: true,
  pure: true,
})
export class MaskPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (value == null || value === '') return '';
    return maskContent(value);
  }
}
