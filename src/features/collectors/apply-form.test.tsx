import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { apply } from '@/content/collectors';

import { CollectorApplyForm } from './apply-form';

function setup(onSubmit = vi.fn().mockResolvedValue({ ok: true })) {
  const user = userEvent.setup();
  render(<CollectorApplyForm onSubmit={onSubmit} />);
  return { onSubmit, user };
}

async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/full name/i), 'Thandi Mokoena');
  await user.type(screen.getByLabelText(/email address/i), 'thandi@example.com');
}

describe('CollectorApplyForm — the fields', () => {
  it('asks for every detail the intake collects', () => {
    setup();

    for (const label of [
      /full name/i,
      /email address/i,
      /phone/i,
      /country of residence/i,
      /city/i,
      /annual income band/i,
      /liquid assets band/i,
      /collecting goal/i,
      /art exposure/i,
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });

  it('groups them under the three headings from the design', () => {
    setup();

    for (const name of [/personal details/i, /financial profile/i, /collecting context/i]) {
      expect(screen.getByRole('heading', { name })).toBeInTheDocument();
    }
  });

  it('marks only name and email as required', () => {
    setup();

    expect(screen.getByLabelText(/full name/i)).toBeRequired();
    expect(screen.getByLabelText(/email address/i)).toBeRequired();

    // The financial questions are intrusive; the design leaves them unmarked
    // and the form must not quietly demand them.
    expect(screen.getByLabelText(/annual income band/i)).not.toBeRequired();
    expect(screen.getByLabelText(/liquid assets band/i)).not.toBeRequired();
    expect(screen.getByLabelText(/phone/i)).not.toBeRequired();
  });

  it('offers every medium as a checkbox, none preselected', () => {
    setup();

    const mediums = screen.getAllByRole('checkbox');
    expect(mediums).toHaveLength(apply.collecting.mediums.length);
    for (const medium of mediums) expect(medium).not.toBeChecked();
  });

  it('opens both bands on the placeholder rather than a guess', () => {
    setup();

    expect(screen.getByLabelText(/annual income band/i)).toHaveValue('');
    expect(screen.getByLabelText(/liquid assets band/i)).toHaveValue('');
  });
});

describe('CollectorApplyForm — submitting', () => {
  it('sends an application with only the required fields', async () => {
    const { onSubmit, user } = setup();

    await fillRequired(user);
    await user.click(screen.getByRole('button', { name: /continue to verification/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ fullName: 'Thandi Mokoena', email: 'thandi@example.com' }),
    );
  });

  it('sends the chosen mediums and drops the deselected ones', async () => {
    const { onSubmit, user } = setup();

    await fillRequired(user);
    await user.click(screen.getByRole('checkbox', { name: 'Painting' }));
    await user.click(screen.getByRole('checkbox', { name: 'Sculpture' }));
    await user.click(screen.getByRole('checkbox', { name: 'Sculpture' }));
    await user.click(screen.getByRole('button', { name: /continue to verification/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ preferredMediums: ['Painting'] });
  });

  it('omits an untouched optional field rather than sending an empty string', async () => {
    const { onSubmit, user } = setup();

    await fillRequired(user);
    await user.click(screen.getByRole('button', { name: /continue to verification/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const sent = onSubmit.mock.calls[0][0];
    expect(sent.phone).toBeUndefined();
    expect(sent.annualIncomeBand).toBeUndefined();
  });

  it('blocks a submission with no name and does not call the server', async () => {
    const { onSubmit, user } = setup();

    await user.type(screen.getByLabelText(/email address/i), 'thandi@example.com');
    await user.click(screen.getByRole('button', { name: /continue to verification/i }));

    expect(await screen.findByText(/full name is required/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('blocks a malformed email and does not call the server', async () => {
    const { onSubmit, user } = setup();

    await user.type(screen.getByLabelText(/full name/i), 'Thandi Mokoena');
    await user.type(screen.getByLabelText(/email address/i), 'thandi@');
    await user.click(screen.getByRole('button', { name: /continue to verification/i }));

    expect(await screen.findByText(/enter a valid email address/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('confirms receipt instead of leaving the applicant on a filled form', async () => {
    const { user } = setup();

    await fillRequired(user);
    await user.click(screen.getByRole('button', { name: /continue to verification/i }));

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent(/received/i);
  });

  it('keeps what was typed when the save fails', async () => {
    // Losing a completed application to a transient error would be the worst
    // possible outcome for this particular form.
    const { user } = setup(vi.fn().mockResolvedValue({ ok: false }));

    await fillRequired(user);
    await user.click(screen.getByRole('button', { name: /continue to verification/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not save/i);
    expect(screen.getByLabelText(/full name/i)).toHaveValue('Thandi Mokoena');
  });

  it('surfaces a field error raised by the server', async () => {
    const { user } = setup(
      vi
        .fn()
        .mockResolvedValue({ ok: false, fieldErrors: { email: 'That email is already used' } }),
    );

    await fillRequired(user);
    await user.click(screen.getByRole('button', { name: /continue to verification/i }));

    expect(await screen.findByText(/already used/i)).toBeInTheDocument();
  });

  it('does not submit twice on a double click', async () => {
    const { onSubmit, user } = setup(
      vi
        .fn()
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(() => resolve({ ok: true }), 50)),
        ),
    );

    await fillRequired(user);
    const submit = screen.getByRole('button', { name: /continue to verification/i });
    await user.click(submit);
    await user.click(submit);

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  });
});
