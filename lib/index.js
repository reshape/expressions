const parseExpression = require('./expression_parser')
const runtime = require('./runtime')

let delimiters, unescapeDelimiters, delimiterRegex, unescapeDelimiterRegex, conditionals, loops, options

module.exports = function reshapeExpressions (_options = {}) {
  options = _options
  // set up delimiter options and detection
  delimiters = options.delimiters || ['{{', '}}']
  unescapeDelimiters = options.unescapeDelimiters || ['{{{', '}}}']
  delimiterRegex = new RegExp(`.*${delimiters[0]}(.*)${delimiters[1]}.*`, 'g')
  unescapeDelimiterRegex = new RegExp(`.*${unescapeDelimiters[0]}(.*)${unescapeDelimiters[1]}.*`, 'g')

  // identification for delimiter options, for the parser
  delimiters.push('escaped')
  unescapeDelimiters.push('unescaped')

  // conditional and loop options
  conditionals = options.conditionalTags || ['if', 'elseif', 'else']
  loops = options.loopTags || ['each']

  // kick off the parsing
  return function expressionsPlugin (nodes, phOpts) {
    return walk(options, nodes, phOpts)
  }
}

function walk (opts, nodes, reshapeOpts) {
  // on the first call, add the runtime helpers
  if (reshapeOpts) {
    reshapeOpts.runtime = Object.assign(reshapeOpts.runtime, runtime)
  }

  // After a conditional has been resolved, we remove the conditional elements
  // from the tree. This variable determines how many to skip afterwards.
  let skip

  // loop through each node in the tree
  return nodes.reduce((m, node, i) => {
    // if we're skipping this node, return immediately
    if (skip) { skip--; return m }

    // if we have a text node, match and replace the contents
    if (node.type === 'text') {
      // if there are any matches, we split into text and code nodes
      if (node.content.match(delimiterRegex) || node.content.match(unescapeDelimiterRegex)) {
        // TODO: this could be optimized by starting at the regex match index
        const newNodes = parseExpression([delimiters, unescapeDelimiters], node.content)
        m = m.concat(newNodes)
        return m
      }
      m.push(node)
      return m
    }

    // if it's a tag node, we need to run the attributes and contents
    if (node.type === 'tag') {
      for (let key in node.attrs) {
        // attributes can be one or more nodes of any type, so we coerce to
        // array and run through them
        node.attrs[key] = Array.prototype.concat(node.attrs[key])
        // we reduce because code nodes are typically split into more than one
        // node, so we need control over the number of result nodes
        node.attrs[key] = node.attrs[key].reduce((m, node) => {
          // if there's an expression in the node's contents, run it and
          // push all resulting nodes to the result
          if (node.content.match(delimiterRegex)) {
            m = m.concat(parseExpression([delimiters, unescapeDelimiters], node.content))
            return m
          }
          // otherwise just push the node into the result as-is
          m.push(node)
          return m
        }, [])
      }

      // if the node has content, recurse (unless it's a loop, handled later)
      if (node.content && node.name !== loops[0]) {
        node.content = walk(opts, node.content)
      }

      // if we have an element matching "if", we've got a conditional
      // this comes after the recursion to correctly handle nested loops
      if (node.name === conditionals[0]) {
        // throw an error if it's missing the "condition" attribute
        if (!(node.attrs && node.attrs.condition)) {
          throw new Error(`the "${conditionals[0]}" tag must have a "condition" attribute`)
        }

        // we are replacing the if statement nodes with a new code node that
        // will execute and return the correct html
        const newNode = {
          type: 'code',
          nodes: []
        }

        // build the expression object, which we will turn into js
        const ast = [{
          statement: 'if',
          condition: node.attrs.condition[0].content,
          content: node.content
        }]
        newNode.nodes.push(node.content)

        // move through the nodes and collect all others that are part of the
        // same conditional statement
        let [current, nextTag] = getNextTag(nodes, ++i)
        while (conditionals.slice(-2).indexOf(nextTag.name) > -1) {
          const obj = { statement: nextTag.name, content: nextTag.content }

          // ensure the "else" tag is represented in our little AST as 'else',
          // even if a custom tag was used
          if (nextTag.name === conditionals[2]) obj.statement = 'else'

          // add the condition if it's an else if
          if (nextTag.name === conditionals[1]) {
            // throw an error if an "else if" is missing a condition
            if (!(nextTag.attrs && nextTag.attrs.condition)) {
              throw new Error(`the "${conditionals[1]}" tag must have a "condition" attribute`)
            }
            obj.condition = Array.prototype.concat(nextTag.attrs.condition)[0].content

            // while we're here, expand "elseif" to "else if"
            obj.statement = 'else if'
          }
          ast.push(obj)
          newNode.nodes.push(walk(opts, nextTag.content))

          ;[current, nextTag] = getNextTag(nodes, ++current)
        }

        // format into an expression
        let expression = '(function () { '
        expression += ast.reduce((m2, e, i) => {
          m2 += e.statement
          if (e.condition) m2 += ` (${e.condition})`
          m2 += ` { return __nodes[${i}] } `
          return m2
        }, '')

        // if there's no "else", add one that returns empty string. if this is
        // not present, it will return "undefined" as text in the template
        if (!(ast.find((n) => n.statement === 'else'))) {
          expression += "else { return '' } "
        }

        expression += '})()'

        // add our expression to the code node
        newNode.content = expression

        // remove all of the conditional tags from the tree
        // we subtract 1 from i as it's incremented from the initial if
        // statement in order to get the next node
        skip = current - i
        m.push(newNode)
        return m
      }

      // parse loops
      if (node.name === loops[0]) {
        // handle syntax error
        if (!(node.attrs && node.attrs.loop)) {
          throw new Error(`the "${conditionals[1]}" tag must have a "loop" attribute`)
        }

        // parse the "loop" param
        const {keys, expression, loopType} = parseLoopStatement(node.attrs.loop[0].content)

        // prepare our new code node for the loop
        const newNode = {
          type: 'code',
          nodes: [walk(options, node.content)]
        }

        if (keys.length < 1 || keys[0] === '') {
          throw new Error('You must provide at least one loop argument')
        }

        let expr = ''

        if (loopType === 'of') {
          // add the expression
          expr += `(${expression}).map(function (`
          // TODO: refactor this into a loop
          if (keys.length === 1) {
            expr += `${keys[0]}`
          } else {
            expr += `${keys[0]}, ${keys[1]}`
          }
          expr += ') { return __nodes[0] }).join(\'\')'
        }

        // swap of and in
        if (loopType === 'in') {
          const key = keys[1] || 'key'
          expr += `(function () { var res = []; var expr = (${expression}); for (var ${key} in expr) { var ${keys[0]} = expr[${key}]; res.push(__nodes[0]) } return res.join('') })()`
        }

        newNode.content = expr

        // return directly out of the loop, which will skip the "each" tag
        m.push(newNode)
        return m
      }
    }

    // return the node
    m.push(node)
    return m
  }, [])
}

function getNextTag (nodes, i, nodeCount) {
  // loop until we get the next tag (bypassing newlines etc)
  while (i < nodes.length) {
    const node = nodes[i]
    if (node.type === 'tag') {
      return [i, node]
    } else {
      i++
    }
  }
  return [i, { type: undefined }]
}

/**
 * Given a "loop" parameter from an "each" tag, parses out the param names and
 * expression to be looped through using a mini text parser.
 */
function parseLoopStatement (input) {
  let current = 0
  let char = input[current]

  // parse through keys `each **foo, bar** in x`, which is everything before
  // the word "in"
  const keys = []
  let key = ''
  while (!`${char}${lookahead(3)}`.match(/\s(in|of)\s/)) {
    key += char
    next()

    // if we hit a comma, we're on to the next key
    if (char === ',') {
      keys.push(key.trim())
      key = ''
      next()
    }

    // if we reach the end of the string without getting "in/of", it's an error
    if (typeof char === 'undefined') {
      throw new Error("Loop statement lacking 'in' or 'of' keyword")
    }
  }
  keys.push(key.trim())

  // detect whether it's an in or of
  const loopType = lookahead(2)

  // space before, in/of, space after
  next(4)

  // the rest of the string is evaluated as the array/object to loop
  let expression = ''
  while (current < input.length) {
    expression += char
    next()
  }

  return {keys, expression, loopType}

  // Utility: Move to the next character in the parse
  function next (n = 1) {
    for (let i = 0; i < n; i++) { char = input[++current] }
  }

  // Utility: looks ahead n characters and returns the result
  function lookahead (n) {
    let counter = current
    const target = current + n
    let res = ''
    while (counter < target) {
      res += input[++counter]
    }
    return res
  }
}
