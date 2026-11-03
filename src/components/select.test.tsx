import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SelectField } from './select';

function setup(onChange = vi.fn()) {
  render(
    <SelectField id="term" label="Term" value="t1" onChange={(e) => onChange(e.target.value)}>
      <option value="t1">Term 1</option>
      <option value="t2">Term 2</option>
    </SelectField>
  );
  return onChange;
}

describe('SelectField', () => {
  it('shows the selected label on the trigger and keeps a labelled native select', () => {
    setup();
    expect(screen.getByRole('combobox', { name: 'Term: Term 1' })).toBeInTheDocument();
    expect(screen.getByLabelText('Term')).toHaveValue('t1');
  });

  it('opens the listbox and reports the picked value through onChange', async () => {
    const user = userEvent.setup();
    const onChange = setup();
    await user.click(screen.getByRole('combobox', { name: 'Term: Term 1' }));
    await user.click(screen.getByRole('option', { name: 'Term 2' }));
    expect(onChange).toHaveBeenCalledWith('t2');
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('combobox', { name: 'Term: Term 1' }));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
