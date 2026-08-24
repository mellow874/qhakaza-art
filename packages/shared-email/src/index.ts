/**
 * Email for the Qhakaza platform.
 *
 * Provider-agnostic by design: the default writes to the log so that nothing is
 * blocked while the provider and its DNS records are still being arranged.
 */
export * from './service';
export * from './templates';
