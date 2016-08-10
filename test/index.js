const test = require('ava')
const path = require('path')
const reshape = require('reshape')
const exp = require('../lib')
const {readFileSync} = require('fs')
const fixtures = path.join(__dirname, 'fixtures')

test('basic', (t) => {
  return matchExpected(t, 'basic', { locals: { test: 'wow' } })
})

test('escaped html', (t) => {
  return matchExpected(t, 'escape_html', { locals: { lt: '<', gt: '>' } })
})

test('unescaped', (t) => {
  return matchExpected(t, 'unescaped', {
    locals: { el: '<strong>wow</strong>' }
  })
})

test('custom delimiters', (t) => {
  return matchExpected(t, 'custom_delimiters', {
    delimiters: ['<%=', '%>'],
    unescapeDelimiters: ['<%-', '%>'],
    locals: { test: 'wow' }
  })
})

test('expression spacing', (t) => {
  return matchExpected(t, 'expression_spacing', { locals: { foo: 'X' } })
})

test('expression error', (t) => {
  return expectError('expression_error', (err) => {
    t.truthy(err.toString() === "SyntaxError: Unexpected character '@' (1:29)")
  })
})

test('conditional', (t) => {
  return matchExpected(t, 'conditional', { locals: { foo: 'bar' } })
})

test('conditional - only "if" condition', (t) => {
  return matchExpected(t, 'conditional_if', { locals: { foo: 'bar' } })
})

test('conditional - no render', (t) => {
  return matchExpected(t, 'conditional_norender', {})
})

test('conditional - "if" tag missing condition', (t) => {
  return expectError('conditional_if_error', (err) => {
    t.truthy(err.toString() === 'Error: the "if" tag must have a "condition" attribute')
  })
})

test('conditional - "elseif" tag missing condition', (t) => {
  return expectError('conditional_elseif_error', (err) => {
    t.truthy(err.toString() === 'Error: the "elseif" tag must have a "condition" attribute')
  })
})

test('conditional - other tag in middle of statement', (t) => {
  return matchExpected(t, 'conditional_tag_break', {})
})

test('conditional - nested conditionals', (t) => {
  return matchExpected(t, 'conditional_nested', {})
})

test('conditional - expression error', (t) => {
  return expectError('conditional_expression_error', (err) => {
    t.truthy(err.toString() === "SyntaxError: Unexpected character '#' (1:31)")
  })
})

test('conditional - custom tags', (t) => {
  return matchExpected(t, 'conditional_customtags', {
    conditionalTags: ['zif', 'zelseif', 'zelse'],
    locals: { foo: 'bar' }
  })
})

test('loop', (t) => {
  return matchExpected(t, 'loop', { locals: { items: [1, 2, 3] } })
})

test('loop object', (t) => {
  return matchExpected(t, 'loop_object', {
    locals: { items: { a: 'b', c: 'd' } }
  })
})

test('loop with other locals included', (t) => {
  return matchExpected(t, 'loop_locals', {
    locals: { items: [1, 2, 3], foo: 'bar' }
  })
})

test('loop with conflicting locals', (t) => {
  return matchExpected(t, 'loop_conflict', {
    locals: { items: [1, 2, 3], item: 'bar' }
  })
})

test('nested loops', (t) => {
  return matchExpected(t, 'loop_nested', {
    locals: { items: { c1: [1, 2, 3], c2: [4, 5, 6] } }
  })
})

test('loop - custom tag', (t) => {
  return matchExpected(t, 'loop_customtag', {
    loopTags: ['zeach'],
    locals: { items: [1, 2, 3] }
  })
})

test('loop - no loop attribute', (t) => {
  return expectError('loop_no_attr', (err) => {
    t.truthy(err.toString() === 'Error: the "elseif" tag must have a "loop" attribute')
  })
})

test('loop - no array or object passed', (t) => {
  return matchExpected(t, 'loop_no_collection')
})

test('loop - no loop arguments', (t) => {
  return expectError('loop_no_args', (err) => {
    t.truthy(err.toString() === 'Error: You must provide at least one loop argument')
  })
})

test('loop - no "in" keyword', (t) => {
  return expectError('loop_no_in', (err) => {
    t.truthy(err.toString() === "Error: Loop statement lacking 'in' or 'of' keyword")
  })
})

test('loop - expression error', (t) => {
  return expectError('loop_expression_error', (err) => {
    t.truthy(err.toString() === "SyntaxError: Unexpected character '#' (1:63)")
  })
})

//
// Utility
//

function matchExpected (t, name, config = {}, log = false) {
  const html = readFileSync(path.join(fixtures, `${name}.html`), 'utf8')
  const expected = readFileSync(path.join(fixtures, `${name}.expected.html`), 'utf8')

  return reshape({ plugins: exp(config) })
    .process(html)
    .then((res) => { log && console.log(res.output.toString(), '\n----------\n', res.output(config.locals)); return res })
    .then((res) => { t.truthy(res.output(config.locals).trim() === expected.trim()) })
}

function expectError (name, cb) {
  const html = readFileSync(path.join(fixtures, `${name}.html`), 'utf8')

  return reshape({ plugins: exp() })
    .process(html)
    .then((res) => res.output())
    .then(() => { throw new Error('no error!') })
    .catch(cb)
}
