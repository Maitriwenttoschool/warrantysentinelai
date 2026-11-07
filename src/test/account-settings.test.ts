import { describe, expect, it } from 'vitest';
import { reviewerRoles, profileSettingsSchema } from '../lib/account-settings';

describe('reviewer accounts', () => {
  it('supports exactly the two requested roles', () => {
    expect(reviewerRoles).toEqual(['Warranty Supervisor', 'Warranty Lead Roughneck']);
  });
  it.each([
    { login_id: 'Rnair', first_name: 'Rajesh', last_name: 'Nair' },
    { login_id: 'Jdoe', first_name: 'John', last_name: 'Doe' },
  ])('accepts the requested profile $login_id', profile => {
    expect(profileSettingsSchema.parse(profile)).toEqual(profile);
  });
});