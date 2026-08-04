import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ArtistProfileForm } from './artist-profile-form';

function setup(props: Partial<React.ComponentProps<typeof ArtistProfileForm>> = {}) {
  const onSave = vi.fn().mockResolvedValue({ ok: true });
  const user = userEvent.setup();

  render(<ArtistProfileForm onSave={onSave} {...props} />);

  return { onSave, user };
}

describe('ArtistProfileForm — empty state', () => {
  it('shows the fields an artist needs to fill in', () => {
    setup();

    expect(screen.getByLabelText(/display name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/artist statement/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/instagram/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/website/i)).toBeInTheDocument();
  });

  it('marks the statement and social links as optional', () => {
    setup();

    expect(screen.getByLabelText(/artist statement/i)).not.toBeRequired();
    expect(screen.getByLabelText(/instagram/i)).not.toBeRequired();
  });

  it('starts with empty fields for a new artist', () => {
    setup();

    expect(screen.getByLabelText(/display name/i)).toHaveValue('');
    expect(screen.getByLabelText(/artist statement/i)).toHaveValue('');
  });
});

describe('ArtistProfileForm — editing an existing profile', () => {
  const existing = {
    displayName: 'Thandi Mokoena',
    statement: 'I paint the highveld.',
    socials: { instagram: 'https://instagram.com/thandi', website: 'https://thandi.art' },
  };

  it('prefills the fields', () => {
    setup({ profile: existing });

    expect(screen.getByLabelText(/display name/i)).toHaveValue('Thandi Mokoena');
    expect(screen.getByLabelText(/artist statement/i)).toHaveValue('I paint the highveld.');
    expect(screen.getByLabelText(/instagram/i)).toHaveValue('https://instagram.com/thandi');
    expect(screen.getByLabelText(/website/i)).toHaveValue('https://thandi.art');
  });

  it('labels the submit button as saving changes rather than creating', () => {
    setup({ profile: existing });

    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
  });
});

describe('ArtistProfileForm — validation', () => {
  it('will not submit without a display name, and says why', async () => {
    const { onSave, user } = setup();

    await user.click(screen.getByRole('button', { name: /continue/i }));

    expect(await screen.findByText(/display name is required/i)).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('rejects a social link that is not a URL', async () => {
    const { onSave, user } = setup();

    await user.type(screen.getByLabelText(/display name/i), 'Thandi Mokoena');
    await user.type(screen.getByLabelText(/instagram/i), 'thandi');
    await user.click(screen.getByRole('button', { name: /continue/i }));

    expect(await screen.findByText(/full url/i)).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('associates the error with the field for screen readers', async () => {
    const { user } = setup();

    await user.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/display name/i)).toHaveAccessibleDescription(
        /display name is required/i,
      );
    });
  });

  it('clears the error once the field is corrected and resubmitted', async () => {
    const { onSave, user } = setup();

    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(await screen.findByText(/display name is required/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/display name/i), 'Thandi Mokoena');
    await user.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(screen.queryByText(/display name is required/i)).not.toBeInTheDocument();
  });
});

describe('ArtistProfileForm — submitting', () => {
  it('sends the trimmed values, omitting blank optional fields', async () => {
    const { onSave, user } = setup();

    await user.type(screen.getByLabelText(/display name/i), '  Thandi Mokoena  ');
    await user.type(screen.getByLabelText(/artist statement/i), 'I paint the highveld.');
    await user.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        displayName: 'Thandi Mokoena',
        statement: 'I paint the highveld.',
      }),
    );
  });

  it('includes only the social links that were filled in', async () => {
    const { onSave, user } = setup();

    await user.type(screen.getByLabelText(/display name/i), 'Thandi Mokoena');
    await user.type(screen.getByLabelText(/website/i), 'https://thandi.art');
    await user.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        displayName: 'Thandi Mokoena',
        socials: { website: 'https://thandi.art' },
      }),
    );
  });

  it('disables the button and announces progress while saving', async () => {
    let release: (value: { ok: true }) => void = () => {};
    const onSave = vi.fn().mockReturnValue(
      new Promise<{ ok: true }>((resolve) => {
        release = resolve;
      }),
    );
    const user = userEvent.setup();
    render(<ArtistProfileForm onSave={onSave} />);

    await user.type(screen.getByLabelText(/display name/i), 'Thandi Mokoena');
    await user.click(screen.getByRole('button', { name: /continue/i }));

    const button = screen.getByRole('button', { name: /saving/i });
    expect(button).toBeDisabled();

    release({ ok: true });
    await waitFor(() => expect(button).not.toBeDisabled());
  });

  it('does not submit again while a save is still in flight', async () => {
    let release: (value: { ok: true }) => void = () => {};
    const onSave = vi.fn().mockReturnValue(
      new Promise<{ ok: true }>((resolve) => {
        release = resolve;
      }),
    );
    const user = userEvent.setup();
    render(<ArtistProfileForm onSave={onSave} />);

    await user.type(screen.getByLabelText(/display name/i), 'Thandi Mokoena');
    await user.click(screen.getByRole('button', { name: /continue/i }));

    // Still saving — a second attempt must not fire another request.
    await user.click(screen.getByRole('button', { name: /saving/i }));
    expect(onSave).toHaveBeenCalledTimes(1);

    release({ ok: true });
    await waitFor(() => expect(screen.getByRole('button')).toBeEnabled());
  });

  it('allows a second save once the first has finished', async () => {
    const { onSave, user } = setup();

    await user.type(screen.getByLabelText(/display name/i), 'Thandi Mokoena');
    await user.click(screen.getByRole('button', { name: /continue/i }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole('button', { name: /continue/i }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
  });

  it('surfaces a server-side field error', async () => {
    const onSave = vi.fn().mockResolvedValue({
      ok: false,
      error: 'INVALID',
      fieldErrors: { displayName: 'That name is already taken' },
    });
    const user = userEvent.setup();
    render(<ArtistProfileForm onSave={onSave} />);

    await user.type(screen.getByLabelText(/display name/i), 'Thandi Mokoena');
    await user.click(screen.getByRole('button', { name: /continue/i }));

    expect(await screen.findByText(/already taken/i)).toBeInTheDocument();
  });

  it('shows a recoverable message when the save fails outright', async () => {
    const onSave = vi.fn().mockResolvedValue({ ok: false, error: 'UNKNOWN' });
    const user = userEvent.setup();
    render(<ArtistProfileForm onSave={onSave} />);

    await user.type(screen.getByLabelText(/display name/i), 'Thandi Mokoena');
    await user.click(screen.getByRole('button', { name: /continue/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not save/i);
    expect(screen.getByRole('button', { name: /continue/i })).toBeEnabled();
  });
});
