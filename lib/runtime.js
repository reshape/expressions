module.exports = {
  // shamelessly stolen from jade/pug's runtime
  // https://github.com/pugjs/pug-runtime/blob/master/index.js#L189
  escape: function (input) {
    const htmlRegex = /["&<>]/
    const regexResult = htmlRegex.exec(input)
    if (!regexResult) return input

    let result = ''
    let i, lastIndex, escape
    for (i = regexResult.index, lastIndex = 0; i < input.length; i++) {
      switch (input.charCodeAt(i)) {
        case 34: escape = '&quot;'; break
        case 38: escape = '&amp;'; break
        case 60: escape = '&lt;'; break
        case 62: escape = '&gt;'; break
        default: continue
      }
      if (lastIndex !== i) result += input.substring(lastIndex, i)
      lastIndex = i + 1
      result += escape
    }
    if (lastIndex !== i) return result + input.substring(lastIndex, i)
    else return result
  }
}
