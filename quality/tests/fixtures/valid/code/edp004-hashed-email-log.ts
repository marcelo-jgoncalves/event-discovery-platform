// VALID fixture (EDP004): only the hashed form is logged — must pass.
import { hashPII } from '../../../../services/identity/src/pii/hash.ts';

interface User {
  email: string;
}

function debugSignup(user: User) {
  console.log({ emailHash: hashPII(user.email) });
}
