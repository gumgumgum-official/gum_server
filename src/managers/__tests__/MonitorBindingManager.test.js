const MonitorBindingManager = require('../MonitorBindingManager');

describe('MonitorBindingManager', () => {
  let mgr;

  beforeEach(() => {
    mgr = new MonitorBindingManager();
  });

  test('첫 instance는 monitor-1', () => {
    const r = mgr.bind('a-1');
    expect(r.monitorId).toBe('monitor-1');
    expect(r.monitorNumber).toBe(1);
  });

  test('둘째 instance는 monitor-2', () => {
    mgr.bind('a-1');
    const r = mgr.bind('b-2');
    expect(r.monitorId).toBe('monitor-2');
    expect(r.monitorNumber).toBe(2);
  });

  test('같은 instanceId는 항상 동일 monitor', () => {
    expect(mgr.bind('x').monitorId).toBe('monitor-1');
    expect(mgr.bind('x').monitorId).toBe('monitor-1');
  });

  test('세 번째는 null', () => {
    mgr.bind('1');
    mgr.bind('2');
    expect(mgr.bind('3')).toBeNull();
  });

  test('release 후 슬롯 재사용', () => {
    mgr.bind('1');
    mgr.bind('2');
    expect(mgr.bind('3')).toBeNull();
    mgr.release('1');
    const r = mgr.bind('3');
    expect(r.monitorId).toBe('monitor-1');
  });
});
