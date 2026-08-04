/**
 * @qhakaza/shared-ui — components used by more than one app.
 *
 * Admission rule, enforced by review: a component belongs here only if two or
 * more of Vera, the Collector Platform and the Command Center use it. Chrome
 * (headers, footers, wordmarks) and anything section-shaped is app-specific and
 * stays in the app that owns it, even when the markup looks similar.
 *
 * These four qualify because both the artist and collector sides already use
 * them today — verified by import, not assumed.
 */

export { Button, buttonStyles } from './button';
export { Field } from './field';
export { EditorialImage } from './editorial-image';
export { cn } from './cn';
