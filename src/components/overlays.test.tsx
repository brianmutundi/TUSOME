import { describe, expect, it, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog, RadioCardGroup } from './overlays';

beforeAll(() => {
  // jsdom does not implement the modal <dialog> API.
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute('open');
  };
});

describe('RadioCardGroup', () => {
  it('exposes a labelled radio group and reports changes', async () => {
    const onChange = vi.fn();
    render(
      <RadioCardGroup
        legend="Payment method"
        name="method"
        value="cash"
        onChange={onChange}
        options={[
          { value: 'cash', label: 'Cash' },
          { value: 'mpesa', label: 'M-Pesa', description: 'Paybill or till' },
        ]}
      />
    );
    expect(screen.getByRole('group', { name: 'Payment method' })).toBeTruthy();
    expect((screen.getByRole('radio', { name: /Cash/ }) as HTMLInputElement).checked).toBe(true);
    await userEvent.click(screen.getByRole('radio', { name: /M-Pesa/ }));
    expect(onChange).toHaveBeenCalledWith('mpesa');
  });
});

describe('ConfirmDialog', () => {
  it('keeps the destructive button disabled until the phrase is typed', async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Reverse payment?"
        confirmLabel="Reverse"
        requirePhrase="REVERSE"
        onConfirm={onConfirm}
        onCancel={() => undefined}
      />
    );
    const button = screen.getByRole('button', { name: 'Reverse', hidden: true }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    await userEvent.type(screen.getByLabelText(/Type REVERSE/, { selector: 'input' }), 'REVERSE');
    expect(button.disabled).toBe(false);
    await userEvent.click(button);
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
