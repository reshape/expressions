// "escape" shamelessly stolen from jade/pug's runtime
// https://github.com/pugjs/pug-runtime/blob/master/index.js#L189

module.exports = {
  escape: function (input) {
    var htmlRegex = /["&<>]/
    var regexResult = htmlRegex.exec(input)
    if (!regexResult) { return input }

    var result = ''
    var i, lastIndex, escape
    for (i = regexResult.index, lastIndex = 0; i < input.length; i++) {
      switch (input.charCodeAt(i)) {
        case 34: escape = '&quot;'; break
        case 38: escape = '&amp;'; break
        case 60: escape = '&lt;'; break
        case 62: escape = '&gt;'; break
        default: continue
      }
      if (lastIndex !== i) { result += input.substring(lastIndex, i) }
      lastIndex = i + 1
      result += escape
    }
    return (lastIndex !== i ? result + input.substring(lastIndex, i) : result)
  }
}
