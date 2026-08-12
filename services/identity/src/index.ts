// Public surface of services/identity. Deliberately does NOT re-export
// anything from ./pii/* (cognito-client.ts, hash.ts) - that module is the
// only one in the monorepo allowed to touch raw PII (spec-identity.md §8),
// and the architecture fitness function enforces that no other module
// imports it, including transitively through this index. External callers
// use signup()/login() below, never the Cognito client directly.
export * from './domain/types.ts';
export * from './domain/consent.ts';
export * from './domain/account-status.ts';
export * from './infra/users-table-repository.ts';
export * from './application/signup.ts';
export * from './application/login.ts';
