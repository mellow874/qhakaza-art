import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { request } from '@/content/collectors';

import { RequestForm } from './request-form';

function setup(onSubmit = vi.fn().mockResolvedValue({ ok: true })) {
  const user = userEvent.setup();
  render(<RequestForm onSubmit={onSubmit} />);
  return { onSubmit, user };
}

describe('RequestForm — fields', () => {
  it('includes name, email, request type, and message fields', () => {
    setup();

    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/type of request/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/your request/i)).toBeInTheDocument();
  });

  it('marks name, email, type, and message as required', () => {
    setup();

    expect(screen.getByLabelText(/full name/i)).toBeRequired();
    expect(screen.getByLabelText(/email address/i)).toBeRequired();
    expect(screen.getByLabelText(/type of request/i)).toBeRequired();
    expect(screen.getByLabelText(/your request/i)).toBeRequired();
  });

  it('offers all request types as options', () => {
    setup();

    const select = screen.getByLabelText(/type of request/i);
    const options = select.querySelectorAll('option');

    // First option is placeholder
    expect(options[0]).toHaveValue('');

    // Then the four types
    for (const type of request.form.types) {
      expect(screen.getByRole('option', { name: type.label })).toBeInTheDocument();
    }
  });
});

describe('RequestForm — submitting', () => {
  it('sends a complete request when all fields are filled', async () => {
    const { onSubmit, user } = setup();

    await user.type(screen.getByLabelText(/full name/i), 'Thandi Mokoena');
    await user.type(screen.getByLabelText(/email address/i), 'thandi@example.com');
    await user.selectOptions(screen.getByLabelText(/type of request/i), 'artist');
    await user.type(
      screen.getByLabelText(/your request/i),
      'I am interested in contemporary South African painting.',
    );
    await user.click(screen.getByRole('button', { name: /send request/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Thandi Mokoena',
        email: 'thandi@example.com',
        subject: 'artist',
        message: 'I am interested in contemporary South African painting.',
      }),
    );
  });

  it('blocks a submission without a name', async () => {
    const { onSubmit, user } = setup();

    await user.type(screen.getByLabelText(/email address/i), 'thandi@example.com');
    await user.selectOptions(screen.getByLabelText(/type of request/i), 'artwork');
    await user.type(screen.getByLabelText(/your request/i), 'Enquiry');
    await user.click(screen.getByRole('button', { name: /send request/i }));

    expect(await screen.findByText(/full name is required/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('blocks a malformed email', async () => {
    const { onSubmit, user } = setup();

    await user.type(screen.getByLabelText(/full name/i), 'Thandi Mokoena');
    await user.type(screen.getByLabelText(/email address/i), 'invalid@');
    await user.selectOptions(screen.getByLabelText(/type of request/i), 'artwork');
    await user.type(screen.getByLabelText(/your request/i), 'Enquiry');
    await user.click(screen.getByRole('button', { name: /send request/i }));

    expect(await screen.findByText(/enter a valid email address/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('blocks a submission without selecting a request type', async () => {
    const { onSubmit, user } = setup();

    await user.type(screen.getByLabelText(/full name/i), 'Thandi Mokoena');
    await user.type(screen.getByLabelText(/email address/i), 'thandi@example.com');
    await user.type(screen.getByLabelText(/your request/i), 'Enquiry');
    await user.click(screen.getByRole('button', { name: /send request/i }));

    expect(await screen.findByText(/please select the type of request/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('blocks a submission without a message', async () => {
    const { onSubmit, user } = setup();

    await user.type(screen.getByLabelText(/full name/i), 'Thandi Mokoena');
    await user.type(screen.getByLabelText(/email address/i), 'thandi@example.com');
    await user.selectOptions(screen.getByLabelText(/type of request/i), 'experience');
    await user.click(screen.getByRole('button', { name: /send request/i }));

    expect(await screen.findByText(/your request is required/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows success message when request is sent', async () => {
    const { user } = setup();

    await user.type(screen.getByLabelText(/full name/i), 'Thandi Mokoena');
    await user.type(screen.getByLabelText(/email address/i), 'thandi@example.com');
    await user.selectOptions(screen.getByLabelText(/type of request/i), 'artist');
    await user.type(screen.getByLabelText(/your request/i), 'Enquiry');
    await user.click(screen.getByRole('button', { name: /send request/i }));

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent(/received/i);
  });

  it('preserves data when the submission fails', async () => {
    const { user } = setup(vi.fn().mockResolvedValue({ ok: false }));

    await user.type(screen.getByLabelText(/full name/i), 'Thandi Mokoena');
    await user.type(screen.getByLabelText(/email address/i), 'thandi@example.com');
    await user.selectOptions(screen.getByLabelText(/type of request/i), 'artist');
    await user.type(screen.getByLabelText(/your request/i), 'Enquiry');
    await user.click(screen.getByRole('button', { name: /send request/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not send/i);
    expect(screen.getByLabelText(/full name/i)).toHaveValue('Thandi Mokoena');
  });

  it('does not submit twice on double-click', async () => {
    const { onSubmit, user } = setup(
      vi
        .fn()
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(() => resolve({ ok: true }), 50)),
        ),
    );

    await user.type(screen.getByLabelText(/full name/i), 'Thandi Mokoena');
    await user.type(screen.getByLabelText(/email address/i), 'thandi@example.com');
    await user.selectOptions(screen.getByLabelText(/type of request/i), 'artist');
    await user.type(screen.getByLabelText(/your request/i), 'Enquiry');

    const submit = screen.getByRole('button', { name: /send request/i });
    await user.click(submit);
    await user.click(submit);

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  });
});
