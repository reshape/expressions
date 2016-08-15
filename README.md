# Reshape Expressions

[![npm](https://img.shields.io/npm/v/reshape-expressions.svg?style=flat-square)](https://npmjs.com/package/reshape-expressions)
[![tests](https://img.shields.io/travis/reshape/expressions.svg?style=flat-square)](https://travis-ci.org/reshape/expressions?branch=master)
[![dependencies](https://img.shields.io/david/reshape/expressions.svg?style=flat-square)](https://david-dm.org/reshape/expressions)
[![coverage](https://img.shields.io/coveralls/reshape/expressions.svg?style=flat-square)](https://coveralls.io/r/reshape/expressions?branch=master)

Local variables, expressions, loops, and conditionals in your html.

## Installation

First, install from npm with `npm i reshape-exp --save`, then add it as a plugin to your reshape pipeline:

```js
const reshape = require('reshape')
const exp = require('reshape-expressions')
const {readFileSync} = require('fs')

reshape({ plugins: exp() })
  .process(readFileSync('exampleFile.html', 'utf8'))
  .then((res) => {
    return res.output({ foo: 'bar' }) // => your html
  })
```

## Usage

This plugin provides a syntax for including local variables and expressions in your templates, and also extends custom tags to act as helpers for conditionals and looping.

You have full control over the delimiters used for injecting locals, as well as the tag names for the conditional and loop helpers, if you need them. All options that can be passed to the `expressions` plugin are shown below:

| Option | Description | Default |
| ------ | ----------- | ------- |
| **delimiters** | Array containing beginning and ending delimiters for escaped locals. | `['{{', '}}']` |
| **unescapeDelimiters** | Array containing beginning and ending delimiters for inserting unescaped locals. | `['{{{', '}}}']` |
| **conditionalTags** | Array containing names for tags used for standard `if`/`else if`/`else` logic | `['if', 'elseif', 'else']` |
| **loopTags** | Array containing names for standard `for` loop logic | `['each']` |

### Locals

You can inject locals into any piece of content in your html templates, other than overwriting tag names. For example, if you had the following template:

```html
<div class="{{ myClassName }}">
  My name is {{ myName }}
</div>
```

And passed it through reshape like this:

```js
reshape({ plugins: exp() })
  .process(template)
  .then((res) => res.output({ myClassName: 'introduction', myName: 'Marlo' })))
```

You would get this as your output:

```html
<div class="introduction">My name is Marlo</div>
```

### Unescaped Locals

By default, special characters will be escaped so that they show up as text, rather than html code. For example, the following template:

```html
<p>The fox said, {{ strongStatement }}</p>
```

Called as such:

```js
reshape({ plugins: exp() })
  .process(template)
  .then((res) => res.output({ strongStatement: 'wow!' }))
```

You would see the following output:

```html
<p>The fox said, &lt;strong&gt;wow!&lt;strong&gt;</p>
```

In your browser, you would see the angle brackets, and it would appear as intended. However, if you wanted it instead to be parsed as html, you would need to use the `unescapeDelimiters`, which by default are three curly brackets, like this:

```html
<p>The fox said, {{{ strongStatement }}}</p>
```

In this case, your code would render as html:

```html
<p>The fox said, <strong>wow!<strong></p>
```

### Expressions

You are not limited to just directly rendering local variables either, you can include any type of javascript expression and it will be evaluated, with the result rendered. For example:

```html
<p class="{{ env === 'production' ? 'active' : 'hidden' }}">in production!</p>
```

With this in mind, it is strongly recommended to limit the number and complexity of expressions that are run directly in your template. You can always move the logic back to your config file and provide a function to the locals object for a smoother and easier result. For example:

```html
<p class="{{ isProduction(env) }}">in production!</p>
```

```js
reshape({ plugins: exp() })
  .process(template)
  .then((res) => {
    return res.output({
      production: true
      isProduction: (env) => {
        return env === 'production' ? 'active' : 'hidden'
      }
    })
  })
```

```html
<p class="active">in production!</p>
```

### Conditional Logic

Conditional logic uses normal html tags, and modifies/replaces them with the results of the logic. If there is any chance of a conflict with other custom tag names, you are welcome to change the tag names this plugin looks for in the options. For example, given the following template:

```html
<if condition="foo === 'bar'">
  <p>Foo really is bar! Revolutionary!</p>
</if>
<elseif condition="foo === 'wow'">
  <p>Foo is wow, oh man.</p>
</elseif>
<else>
  <p>Foo is probably just foo in the end.</p>
</else>
```

And the following config:

```js
reshape({ plugins: exp() })
  .process(template)
  .then((res) => res.output({ foo: 'foo' }))
```

Your result would be only this:

```html
<p>Foo is probably just foo in the end.</p>
```

Anything in the `condition` attribute is evaluated directly as an expression.

It should be noted that this is slightly cleaner-looking if you are using the [SugarML parser](https://github.com/reshape/sugarml). But then again so is every other part of html.

```sml
if(condition="foo === 'bar'")
  p Foo really is bar! Revolutionary!
elseif(condition="foo === 'wow'")
  p Foo is wow, oh man.
else
  p Foo is probably just foo in the end.
```

### Loops

You can use the `each` tag to build loops. It works with both arrays and objects. For example:

Input:

```html
<each loop="item, index of anArray">
  <p>{{ index }}: {{ item }}</p>
</each>
```

Config:

```js
reshape({ plugins: exp() })
  .process(template)
  .then((res) => {
    return res.output({
      anArray: ['foo', 'bar'],
      anObject: { foo: 'bar' }
    })
  })
```

Output:

```html
<p>1: foo</p>
<p>2: bar</p>
```

And an example using an object (note that it uses "in" rather than "of", in the same way that this would be handled with javascript natively):

```html
<each loop="value, key in anObject">
  <p>{{ key }}: {{ value }}</p>
</each>
```

Output:

```html
<p>foo: bar</p>
```

The value of the `loop` attribute is not a pure expression evaluation, and it does have a tiny and simple custom parser. Essentially, it starts with one or more variable declarations, comma-separated, followed by the word `in`, followed by an expression.

So this would also be fine:

```html
<each loop="item in [1,2,3]">
  <p>{{ item }}</p>
</each>
```

So you don't need to declare all the available variables (in this case, the index is skipped), and the expression after `in` doesn't need to be a local variable, it can be any expression.

### License & Contributing

- Licensed under [MIT](LICENSE)
- See [guidelines for contribution](CONTRIBUTING.md)
