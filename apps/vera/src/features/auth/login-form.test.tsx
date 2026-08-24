import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const signIn = vi.hoisted(() => vi.fn());
const push = vi.hoisted(() => vi.fn());

vi.mock('next-auth/react', () => ({ signIn }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
}));

const { LoginForm } = await import('./login-form');

beforeEach(() => {
  signIn.mockReset();
  push.mockReset();
  signIn.mockResolvedValue({ ok: true, error: null });
});

function setup(props: Partial<React.ComponentProps<typeof LoginForm>> = {}) {
  const user = userEvent.setup();
  render(<LoginForm callbackUrl="/artist/dashboard" {...props} />);
  return { user };
}

describe('LoginForm', () => {
  it('shows email and password fields', () => {
    setup();

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('does not expose the password as readable text', () => {
    setup();

    expect(screen.getByLabelText(/password/i)).toHaveAttribute('type', 'password');
  });

  it('requires an email before submitting', async () => {
    const { user } = setup();

    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/valid email/i)).toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();
  });

  it('requires a password before submitting', async () => {
    const { user } = setup();

    await user.type(screen.getByLabelText(/email/i), 'thandi@qhakaza.art');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/password is required/i)).toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();
  });

  it('signs in with the credentials provider, keeping failures on this page', async () => {
    const { user } = setup();

    await user.type(screen.getByLabelText(/email/i), 'thandi@qhakaza.art');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() =>
      expect(signIn).toHaveBeenCalledWith('credentials', {
        email: 'thandi@qhakaza.art',
        password: 'password123',
        redirect: false,
      }),
    );
  });

  it('sends the artist on to where they were headed once signed in', async () => {
    const { user } = setup();

    await user.type(screen.getByLabelText(/email/i), 'thandi@qhakaza.art');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/artist/dashboard'));
  });

  it('falls back to the home page when no callback url was given', async () => {
    const { user } = setup({ callbackUrl: undefined });

    await user.type(screen.getByLabelText(/email/i), 'thandi@qhakaza.art');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/'));
  });

  it('does not navigate when the credentials were rejected', async () => {
    signIn.mockResolvedValue({ ok: false, error: 'CredentialsSignin' });
    const { user } = setup();

    await user.type(screen.getByLabelText(/email/i), 'thandi@qhakaza.art');
    await user.type(screen.getByLabelText(/password/i), 'wrong-password');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await screen.findByRole('alert');
    expect(push).not.toHaveBeenCalled();
  });

  it('reports bad credentials without revealing which field was wrong', async () => {
    signIn.mockResolvedValue({ ok: false, error: 'CredentialsSignin' });
    const { user } = setup();

    await user.type(screen.getByLabelText(/email/i), 'thandi@qhakaza.art');
    await user.type(screen.getByLabelText(/password/i), 'wrong-password');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/email or password is incorrect/i);
    expect(alert).not.toHaveTextContent(/no account|user not found/i);
  });

  it('re-enables the form after a failed attempt', async () => {
    signIn.mockResolvedValue({ ok: false, error: 'CredentialsSignin' });
    const { user } = setup();

    await user.type(screen.getByLabelText(/email/i), 'thandi@qhakaza.art');
    await user.type(screen.getByLabelText(/password/i), 'wrong-password');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: /sign in/i })).toBeEnabled();
  });

  it('shows progress while signing in', async () => {
    let release: (value: { ok: boolean; error: null }) => void = () => {};
    signIn.mockReturnValue(
      new Promise<{ ok: boolean; error: null }>((resolve) => {
        release = resolve;
      }),
    );
    const { user } = setup();

    await user.type(screen.getByLabelText(/email/i), 'thandi@qhakaza.art');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled();

    release({ ok: true, error: null });
    await waitFor(() => expect(push).toHaveBeenCalled());
  });

  it('offers Google when it is configured', async () => {
    const { user } = setup({ googleEnabled: true });

    await user.click(screen.getByRole('button', { name: /google/i }));

    expect(signIn).toHaveBeenCalledWith('google', { redirectTo: '/artist/dashboard' });
  });

  it('hides Google entirely when it is not configured', () => {
    // The default. A button that opens a broken OAuth screen is worse than no
    // button, and the client cannot see GOOGLE_CLIENT_ID to decide for itself —
    // the page reads it server-side and passes the answer down.
    setup();

    expect(screen.queryByRole('button', { name: /google/i })).not.toBeInTheDocument();
    // ...and the divider that introduces it goes too, rather than leaving an
    // "or" with nothing after it.
    expect(screen.queryByText(/^or$/i)).not.toBeInTheDocument();
  });

  it('still signs in with email and password when Google is absent', async () => {
    const { user } = setup();

    await user.type(screen.getByLabelText(/email/i), 'thandi@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    await waitFor(() => expect(signIn).toHaveBeenCalledTimes(1));
    expect(signIn.mock.calls[0][0]).toBe('credentials');
  });
});
