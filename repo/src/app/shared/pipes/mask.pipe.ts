import { Pipe, PipeTransform } from '@angular/core';
import { maskSensitiveContent } from '../../core/services/messaging.service';

/**
 * MaskPipe — redacts phone numbers and email addresses from display text.
 * Applied in templates where message body is displayed.
 *
 * Usage: {{ message.body | mask }}
 */
@Pipe({
  name: 'mask',
  standalone: true,
  pure: true,
})
export class MaskPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) return '';
    return maskSensitiveContent(value);
  }
}
