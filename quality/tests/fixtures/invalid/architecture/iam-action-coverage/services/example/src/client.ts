import { AdminDeleteUserCommand } from '@aws-sdk/client-cognito-identity-provider';

export function useCommand() {
  return AdminDeleteUserCommand;
}
