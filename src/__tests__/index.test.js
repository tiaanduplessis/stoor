/* eslint-env jest */
'use strict'

import Stoor from '../'

test('should export', () => {
  expect(Stoor).toBeDefined()
})

test('should create new instance', () => {
  expect(new Stoor()).toBeInstanceOf(Stoor)
})

test('should set/get value', () => {
  const foo = new Stoor()
  expect(foo.set('foo', {})).toBeTruthy()
  expect(foo.set('bar', 'hello')).toBeTruthy()
  expect(foo.set('baz', 5)).toBeTruthy()
  expect(foo.get('foo')).toMatchObject({})
  expect(foo.get('bar')).toBe('hello')
  expect(foo.get('baz')).toBe(5)
})

test('should remove value', () => {
  const foo = new Stoor()
  foo.set('foo', 1)
  expect(foo.get('foo')).toBe(1)
  expect(foo.remove('foo')).toBeTruthy()
  expect(foo.get('foo')).toBeNull()
})
