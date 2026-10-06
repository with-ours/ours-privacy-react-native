import React from 'react';
import {render} from '@testing-library/react-native';
import App from '../App';

jest.mock('@oursprivacy/react-native', () => ({
  OursPrivacy: jest.fn().mockImplementation(() => ({
    init: jest.fn().mockResolvedValue(undefined),
  })),
}));

test('shows the SDK demo actions', async () => {
  const screen = await render(<App />);
  expect(screen.getByText('OursPrivacy Demo')).toBeTruthy();
  expect(screen.getByRole('button', {name: 'Track Event'})).toBeTruthy();
  expect(screen.getByRole('button', {name: 'Opt Out'})).toBeTruthy();
});
