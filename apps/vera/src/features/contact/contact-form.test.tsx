import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ContactForm } from './contact-form';

const VALID = {
  name: 'Thandi Mokoena',
  email: 'thandi@example.com',
  subject: 'Subscription question',
  message: 'I would like to know more about registering my artworks on the platform.',
};

function setup(onSubmit = vi.fn().mockResolvedValue({ ok: true })) {
  const user = userEvent.setup();
  render(<ContactForm onSubmit={onSubmit} />);
  return { onSubmit, user };
}

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/name/i), VALID.name);
  await user.type(screen.getByLabelText(/email/i), VALID.email);
  await user.type(screen.getByLabelText(/subject/i), VALID.subject);
  await user.type(screen.getByLabelText(/message/i), VALID.message);
}

describe('ContactForm — fields', () => {
  it('shows every field a visitor must complete', () => {
    setup();

    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/subject/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/message/i)).toBeInTheDocument();
  });

  it('marks them all as required', () => {
    setup();

    for (const label of [/name/i, /email/i, /subject/i, /message/i]) {
      expect(screen.getByLabelText(label)).toBeRequired();
    }
  });
});

describe('ContactForm — validation', () => {
  it('will not submit an empty form', async () => {
    const { onSubmit, user } = setup();

    await user.click(screen.getByRole('button', { name: /send message/i }));

    expect(await screen.findByText(/name is required/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rejects a malformed email', async () => {
    const { onSubmit, user } = setup();

    await user.type(screen.getByLabelText(/name/i), VALID.name);
    await user.type(screen.getByLabelText(/email/i), 'not-an-email');
    await user.type(screen.getByLabelText(/subject/i), VALID.subject);
    await user.type(screen.getByLabelText(/message/i), VALID.message);
    await user.click(screen.getByRole('button', { name: /send message/i }));

    expect(await screen.findByText(/valid email/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('asks for more detail on a one-word message', async () => {
    const { onSubmit, user } = setup();

    await user.type(screen.getByLabelText(/name/i), VALID.name);
    await user.type(screen.getByLabelText(/email/i), VALID.email);
    await user.type(screen.getByLabelText(/subject/i), VALID.subject);
    await user.type(screen.getByLabelText(/message/i), 'hi');
    await user.click(screen.getByRole('button', { name: /send message/i }));

    expect(await screen.findByText(/more detail/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('ContactForm — submitting', () => {
  it('sends the trimmed, normalised values', async () => {
    const { onSubmit, user } = setup();

    await user.type(screen.getByLabelText(/name/i), `  ${VALID.name}  `);
    await user.type(screen.getByLabelText(/email/i), '  THANDI@example.com ');
    await user.type(screen.getByLabelText(/subject/i), VALID.subject);
    await user.type(screen.getByLabelText(/message/i), VALID.message);
    await user.click(screen.getByRole('button', { name: /send message/i }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        name: VALID.name,
        email: 'thandi@example.com',
        subject: VALID.subject,
        message: VALID.message,
      }),
    );
  });

  it('confirms receipt and stops showing the form', async () => {
    const { user } = setup();

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /send message/i }));

    expect(await screen.findByRole('status')).toHaveTextContent(/your message has been received/i);
    expect(screen.queryByLabelText(/message/i)).not.toBeInTheDocument();
  });

  it('does not submit twice while a send is in flight', async () => {
    let release: (value: { ok: true }) => void = () => {};
    const onSubmit = vi.fn().mockReturnValue(
      new Promise<{ ok: true }>((resolve) => {
        release = resolve;
      }),
    );
    const { user } = setup(onSubmit);

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /send message/i }));

    await user.click(screen.getByRole('button', { name: /sending/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);

    release({ ok: true });
    await screen.findByRole('status');
  });

  it('keeps the form usable when the send fails', async () => {
    const onSubmit = vi.fn().mockResolvedValue({ ok: false, error: 'UNKNOWN' });
    const { user } = setup(onSubmit);

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /send message/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not send/i);
    expect(screen.getByLabelText(/message/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send message/i })).toBeEnabled();
  });

  it('surfaces a server-side field error', async () => {
    const onSubmit = vi.fn().mockResolvedValue({
      ok: false,
      error: 'INVALID',
      fieldErrors: { email: 'That address is not accepted' },
    });
    const { user } = setup(onSubmit);

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /send message/i }));

    expect(await screen.findByText(/not accepted/i)).toBeInTheDocument();
  });
});
