import { submitPrivateRequest } from './actions';
import { RequestForm } from './request-form';

/**
 * Connects the form to the server action. Kept separate so the form itself
 * stays a pure component with no server dependency, and can be tested directly.
 */
export function RequestPanel() {
  return <RequestForm onSubmit={submitPrivateRequest} />;
}
