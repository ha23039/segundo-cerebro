// Falla si hay colores literales fuera de los archivos de tokens.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = new URL('../src/', import.meta.url).pathname
const ALLOWED = new Set(['styles/tokens.css', 'styles/tokens-extra.css'])
const EXT = /\.(css|ts|tsx)$/

const NAMED = 'aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen'.split(' ')
const COLOR_PROPS = '(?:color|background(?:-color)?|border(?:-[a-z]+)*|outline(?:-color)?|fill|stroke|box-shadow|text-shadow|caret-color|accent-color|text-decoration(?:-color)?)'
const FUNC = /(?:#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(|\bhwb\(|\blab\(|\blch\(|\boklab\(|\boklch\()/i
const CSS_NAMED = new RegExp(`${COLOR_PROPS}\\s*:[^;]*\\b(${NAMED.join('|')})\\b`, 'i')
// En TS/TSX: valores tipo color: 'red' o background: "white"
const TS_NAMED = new RegExp(`(?:color|background|border|fill|stroke)[A-Za-z]*\\s*:\\s*['"\`](${NAMED.join('|')})['"\`]`, 'i')

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? walk(p) : EXT.test(p) ? [p] : []
  })
}

const problems = []
for (const file of walk(ROOT)) {
  const rel = relative(ROOT, file)
  if (ALLOWED.has(rel) || rel === 'lib/database.types.ts') continue
  const isCss = file.endsWith('.css')
  readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    const code = line.replace(/\/\*.*?\*\/|\/\/.*$/g, '')
    if (FUNC.test(code) || (isCss ? CSS_NAMED : TS_NAMED).test(code)) {
      problems.push(`src/${rel}:${i + 1}: ${line.trim()}`)
    }
  })
}

if (problems.length) {
  console.error('Colores literales encontrados (usa variables de tokens.css):')
  for (const p of problems) console.error('  ' + p)
  process.exit(1)
}
console.log('Sin colores literales.')
