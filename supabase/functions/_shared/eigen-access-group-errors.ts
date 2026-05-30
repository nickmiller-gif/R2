/** Map service-layer access group errors to HTTP status codes. */
export function mapEigenAccessGroupHttpStatus(message: string): number {
  const normalized = message.toLowerCase();
  if (normalized.includes('group not found')) return 404;
  if (normalized.includes('archived access group')) return 409;
  if (normalized.includes('required')) return 400;
  if (normalized.includes('duplicate') || normalized.includes('unique')) return 409;
  return 500;
}
