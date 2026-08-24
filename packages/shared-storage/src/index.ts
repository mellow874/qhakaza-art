/**
 * Object storage for the Qhakaza platform.
 *
 * Provider-agnostic, and safe to import before any credentials exist: with none
 * configured, uploads are refused with a clear reason rather than failing in an
 * obscure way or silently discarding files.
 */
export * from './service';
export * from './paths';
