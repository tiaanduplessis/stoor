import isSupported from '../is-supported'

test('isSupported checks is storage is supported', () => {
  expect(isSupported(window.sessionStorage))
  expect(isSupported(window.localStorage))
  expect(isSupported({})).toBeFalsy()
})
