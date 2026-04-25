const { isValidMonitorIdParam } = require('../monitorId');

describe('monitorId', () => {
  test('monitor-1 / monitor-2 허용', () => {
    expect(isValidMonitorIdParam('monitor-1')).toBe(true);
    expect(isValidMonitorIdParam('monitor-2')).toBe(true);
  });

  test('표준 UUID 허용', () => {
    expect(isValidMonitorIdParam('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(isValidMonitorIdParam('6BA7B810-9DAD-11D1-80B4-00C04FD430C8')).toBe(true);
  });

  test('monitor-99 등 레거시 외 형식 거부', () => {
    expect(isValidMonitorIdParam('monitor-99')).toBe(false);
    expect(isValidMonitorIdParam('../evil')).toBe(false);
    expect(isValidMonitorIdParam('')).toBe(false);
  });
});
