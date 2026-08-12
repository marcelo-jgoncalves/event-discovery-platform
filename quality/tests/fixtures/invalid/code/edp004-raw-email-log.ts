// INVALID fixture (EDP004): raw email logged directly — must be rejected.
interface User {
  email: string;
}

function debugSignup(user: User) {
  console.log({ email: user.email });
}
