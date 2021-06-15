/**
 * Draw a bar chart inside an html element.
 *
 * @param {Array<number> | Array<Array<number>>} data
 * @param {Object<string, number | string>} options
 * @param {jQuery} The parent element for the chart
 *
 * @returns The DOM element containing the chart
 */

function drawBarChart(data, options, element) {
  const settings = processOptions(options, defaults, validProperties)
  const processedData = processData(data)
  const chart = drawChart(element, processedData, settings)
  applyClasses(processedData, settings)
  return chart
}

//==============================================================================
// Process the options
//
//   - User options are expanded from compact dotted keys to nested objects.
//   - Then validated and formatted based on the constant `validProperties`.
//   - CSS properties are enclosed into sub-objects.
//   - Non-CSS properties are directly attached.
//   - The resulting object is merged into a set of defaults.

function getOptionType(pattern, id, prop) {
  for (const type in pattern) {
    for (const pair of pattern[type]) {
      if (pair.ids.includes(id) && pair.props.includes(prop)) return type
    }
  }
  return null
}

function validateOptions(options, pattern) {
  let translated = {}
  for (const id in options) {
    for (const prop in options[id]) {
      const type = getOptionType(pattern, id, prop)
      if (type === 'direct') {
        mergeBranch(translated, [id, prop, options[id][prop]])
      } else if (type === 'css') {
        mergeBranch(translated, [id, 'css', prop, options[id][prop]])
      }
    }
  }
  return translated
}

function processOptions(options, defaults, pattern) {
  const expanded = expandObject(options)
  const validated = validateOptions(expanded, pattern)
  return $.extend(true, {}, defaults, validated)
}

//==============================================================================
// Process the data
//
//   - Check if the array is 1D or 2D.
//   - Compute relevant calculations.
//   - All data arrays are turned to 2D and padded to the maximum sub-length.
//   - The difference to the maximum total value is pushed to later create
//     an empty div at the top of each bar.

function processData(data) {
  // Turn 1D arrays to 2D
  const is2D = Array.isArray(data[0])
  const data2D = is2D
    ? data.map((elem) => [...elem])
    : data.map((elem) => [elem])

  // Calculations
  const sums = collapseArray(data2D, ...toSum)
  const max = sums.reduce(...toMax)
  const maxLength = data2D.reduce(...toMaxLength)

  // Pad and add difference to max at end
  data2D.forEach((arr, i) => {
    padArray(arr, 0, maxLength)
    arr.push(max - sums[i])
  })

  return {
    is2D: is2D,
    barCount: data2D.length,
    subBarCount: maxLength,
    max: max,
    values: data2D,
  }
}

//==============================================================================
// Draw the chart
//
//   - Create div elements and then call functions to create children elements.
//   - Most static properties are pulled from the `settings` object.
//   - Computed properties are calculated as needed and passed forward.
//   - The layout relies on nested CSS grids.
//   - A helper function is used to create the div elements.

//------------------------------------------------------------------------------
// Helper function to append a div element to a parent

function appendDiv(parent, ...props) {
  const merged = mergeSettings({ css: {} }, ...props)
  return $('<div></div>')
    .appendTo(parent)
    .addClass(merged.classes)
    .css(merged.css)
    .text(merged.text)
}

//------------------------------------------------------------------------------
// General helper function to merge objects based on a provided pattern

function mergeObjects(pattern) {
  return (firstObject, ...objects) => {
    return objects.reduce((accum, obj) => {
      return Object.keys(pattern).reduce((merged, key) => {
        if (accum[key] !== undefined && obj[key] !== undefined) {
          // Merge according to pattern when both defined
          merged[key] = pattern[key](accum[key], obj[key])
        } else if (accum[key] !== undefined) {
          // Otherwise keep one or the other
          merged[key] = accum[key]
        } else if (obj[key] !== undefined) {
          merged[key] = obj[key]
        }
        return merged
      }, {})
    }, firstObject)
  }
}

//------------------------------------------------------------------------------
// Helper function to merge settings based on specific rules
//
//   - Strings for classes are joined with a space.
//   - Strings for content are replaced.
//   - CSS objects are merged (using destructuring assignment).

const mergeSettings = mergeObjects({
  classes: (a, b) => a + ' ' + b,
  text: (a, b) => b,
  css: (a, b) => ({ ...a, ...b }),
})

//------------------------------------------------------------------------------
// Compute grid layout properties

function barsGridTemplate(data, settings) {
  const cnt = data.barCount
  const [l, i, r] = settings.bars.gaps
  return (
    `[gridlines-start] ${l} ` +
    `repeat(${cnt - 1}, [bars-start] 1fr ${i}) [bars-start] 1fr ` +
    `${r} [gridlines-end]`
  )
}

function chartGridTemplate(settings, ids, direction, computed) {
  const copied = copyFromObject(settings, ids, ['draw', direction])
  const merged = mergeBranch(copied, computed)
  // Concatenate grid template
  return ids
    .filter((id) => merged[id].draw)
    .map((id) => merged[id][direction])
    .join(' ')
}

//------------------------------------------------------------------------------
// Draw the chart

function drawChart(element, data, settings) {
  const computed = ['bars', 'width', barsGridTemplate(data, settings)]
  const grid_template_columns = chartGridTemplate(
    settings,
    ['yAxisTitle', 'yAxisLabels', 'bars', 'legend'],
    'width',
    computed
  )
  const grid_template_rows = chartGridTemplate(
    settings,
    ['title', 'bars', 'xAxisLabels'],
    'height'
  )
  const css = {
    'grid-template-columns': grid_template_columns,
    'grid-template-rows': grid_template_rows,
  }
  const chart = appendDiv(element, settings.chart, { css })

  drawTitle(chart, settings)
  drawYAxisTitle(chart, settings)
  drawBars(chart, data, settings)
  drawYAxisLabels(chart, data, settings)
  drawGridlines(chart, data, settings)
  drawLegend(chart, data, settings)
  drawXAxisLabels(chart, data, settings)

  return chart
}

//------------------------------------------------------------------------------
// Draw the chart title

function drawTitle(chart, settings) {
  if (settings.title.draw) appendDiv(chart, settings.title)
}

//------------------------------------------------------------------------------
// Draw the Y axis title

function drawYAxisTitle(chart, settings) {
  if (settings.yAxisTitle.draw) appendDiv(chart, settings.yAxisTitle)
}

//------------------------------------------------------------------------------
// Draw the bars

function drawValues(bar, barIndex, barValues, data, settings) {
  const setting = settings.values
  barValues
    .slice(0, -1) // slice off the remainder value
    .forEach((v, subBarIndex) => {
      if (v !== 0) {
        const color = `color${data.is2D ? subBarIndex : barIndex}`
        const classes = `${setting.position} middle ${color}`
        const css = { 'grid-row': data.subBarCount + 1 - subBarIndex }
        const value = appendDiv(bar, setting, { classes, css })
        // Only post value if enough space
        if (setting.draw && value.height() > setting.minHeight)
          value.text(v.toFixed(setting.precision))
      }
    })
}

function drawBars(chart, data, settings) {
  data.values.forEach((barValues, index) => {
    const grid_template_rows = barValues
      .slice() // copy because reverse() mutates the array
      .reverse()
      .map((v) => `${v}fr`)
      .join(' ')
    const css = {
      'grid-column': `bars-start ${index + 1}`,
      'grid-template-rows': grid_template_rows,
    }
    const bar = appendDiv(chart, settings.bars, { css })
    drawValues(bar, index, barValues, data, settings)
  })
}

//------------------------------------------------------------------------------
// Draw the Y axis labels

function drawYAxisLabels(chart, data, settings) {
  const setting = settings.yAxisLabels
  if (setting.draw) {
    // Use placeholder, because labels will have absolute position
    const placeholder = appendDiv(chart, setting)

    // Calculate computed properties
    const height = placeholder.height()
    const interval = Math.round(
      height * (settings.gridlines.interval / data.max)
    )
    const count = Math.floor(height / interval) + 1
    const grid_template_rows = `repeat(${count}, ${interval}px)`
    const css = { 'grid-template-rows': grid_template_rows }

    // Create labels but postpone absolute position
    const labels = appendDiv(chart, setting, { css })

    // Create children
    for (let i = 0; i < count; i++) {
      const classes = 'middle center'
      const text = ((count - i - 1) * settings.gridlines.interval).toFixed(
        setting.precision
      )
      appendDiv(labels, { classes, text })
    }

    // Use placeholder for spacing, then set absolute position
    const shift = (0.45 - count) * interval + height
    placeholder.css({ width: labels.width() })
    labels.css({ position: 'absolute', top: `${shift}px` })
  }
}

//------------------------------------------------------------------------------
// Draw the gridlines

function drawGridlines(chart, data, settings) {
  const setting = settings.gridlines
  if (setting.draw) {
    const gridline = appendDiv(chart, settings.gridlines)
    const height = gridline.height()
    const interval = Math.round(height * (setting.interval / data.max))
    const color = setting.color

    // Issue: Rounded pixel height causes cumulative error.
    // But decimal height causes occasionally thicker gridlines.
    const css = {
      background:
        `repeating-linear-gradient(to top, ${color} 0, ${color} 1.1px, ` +
        `transparent 1px, transparent ${interval}px)`,
    }
    gridline.css(css)
  }
}

//------------------------------------------------------------------------------
// Draw the legend

function drawLegend(chart, data, settings) {
  const setting = settings.legend
  if (setting.draw && data.is2D) {
    const count = data.subBarCount
    const css = { 'grid-template-rows': `1fr repeat(${count}, 1.4em) 1fr` }
    const text = '' // reserve text for children
    const legend = appendDiv(chart, settings.legend, { css, text })

    for (let i = 0; i < count; i++) {
      const classes = `middle center color${i}`
      const text = setting.text[i]
      const css = {
        padding: '0.1em 0.5em',
        'grid-row': `${count + 1 - i}`,
      }
      appendDiv(legend, { classes, text, css })
    }
  }
}

//------------------------------------------------------------------------------
// Draw the X axis labels

function drawXAxisLabels(chart, data, settings) {
  const setting = settings.xAxisLabels
  if (setting.draw) {
    data.values.forEach((val, index) => {
      const text = setting.text[index]
      const css = { 'grid-column': `bars-start ${index + 1}` }
      appendDiv(chart, setting, { css, text })
    })
  }
}

//==============================================================================
// Apply CSS properties to classes

function applyClasses(data, settings) {
  // Generic classes for positioning
  Object.keys(settings.classes).forEach((cls) => {
    $('.' + cls).css(settings.classes[cls])
  })

  // Color classes
  const count = data.is2D ? data.subBarCount : data.barCount
  for (let index = 0; index < count; index++) {
    const colors = settings.bars.colors
    const color = colors[index % colors.length]
    $(`.color${index}`).css({ 'background-color': color })
  }
}

//==============================================================================
// Default and static settings

const defaults = {
  chart: {
    draw: true,
    classes: 'chart',
    css: {
      width: '500px',
      height: '300px',
      'font-family': 'Arial, Helvetica, sans-serif',
      'background-color': 'black',
      color: '#ff8',
      padding: '1.5em 2em 1.5em 2em',
      display: 'grid',
      position: 'relative',
      'box-sizing': 'border-box',
    },
  },
  title: {
    draw: true,
    height: 'auto',
    text: 'Chart title',
    classes: 'title middle top',
    css: {
      'font-size': '130%',
      'grid-column': '1 / -1',
      'grid-row': '1',
      'padding-bottom': '1em',
    },
  },
  yAxisTitle: {
    draw: true,
    width: 'auto',
    classes: 'yAxisTitle middle center',
    text: 'Y axis title',
    css: {
      'writing-mode': 'vertical-rl',
      transform: 'rotate(180deg)',
      'grid-column': '1 / 2',
      'grid-row': 'bars-start / -1',
      'padding-left': '1em',
    },
  },
  yAxisLabels: {
    draw: true,
    precision: 0,
    width: '[y-labels-start] auto',
    classes: 'yAxisLabels',
    css: {
      display: 'grid',
      'grid-column': 'y-labels-start',
      'grid-row': 'bars-start',
      padding: '0 0.5em',
    },
  },
  bars: {
    draw: true,
    height: '[bars-start] 1fr',
    gaps: ['0.25fr', '0.5fr', '0.25fr'],
    colors: ['#fb09', '#f809', '#f409', '#f809'],
    classes: 'bar',
    css: {
      display: 'grid',
      'grid-row': 'bars-start',
      'z-index': 2,
    },
  },
  values: {
    draw: true,
    position: 'center',
    precision: 1,
    minHeight: 20,
    css: {
      padding: '2px 0',
    },
  },
  gridlines: {
    draw: true,
    interval: 5,
    color: '#fff6',
    classes: 'gridlines',
    css: {
      'grid-column': 'gridlines-start / gridlines-end',
      'grid-row': 'bars-start',
      'z-index': 1,
    },
  },
  legend: {
    draw: true,
    width: 'auto',
    classes: 'legend',
    text: ['V1', 'V2', 'V3', 'V4'],
    css: {
      padding: '0 0em 0 2em',
      display: 'grid',
      'grid-column': '-2',
      'grid-row': 'bars-start / -1',
      'grid-gap': '0.75em',
    },
  },
  xAxisLabels: {
    draw: true,
    height: '1.75em',
    classes: 'label middle bottom',
    text: ['A', 'B', 'C', 'D'],
    css: {
      'grid-row': '-2',
    },
  },
  classes: {
    left: {
      display: 'flex',
      'justify-content': 'flex-start',
    },
    middle: {
      display: 'flex',
      'justify-content': 'center',
    },
    right: {
      display: 'flex',
      'justify-content': 'flex-end',
    },
    top: {
      display: 'flex',
      'align-items': 'flex-start',
    },
    center: {
      display: 'flex',
      'align-items': 'center',
    },
    bottom: {
      display: 'flex',
      'align-items': 'flex-end',
    },
  },
}

//==============================================================================
// Pattern used to validate and format the options

const validProperties = {
  direct: [
    { ids: ['gridlines'], props: ['interval', 'color'] },
    { ids: ['bars'], props: ['colors', 'gaps'] },
    { ids: ['values'], props: ['position', 'precision'] },
    { ids: ['yAxisLabels'], props: ['precision'] },
    { ids: ['yAxisLabels', 'gridlines', 'values'], props: ['draw'] },
    {
      ids: ['title', 'yAxisTitle', 'legend', 'xAxisLabels'],
      props: ['draw', 'text'],
    },
  ],
  css: [
    { ids: ['chart'], props: ['width', 'height', 'background-color'] },
    {
      ids: [
        'chart',
        'title',
        'yAxisTitle',
        'yAxisLabels',
        'values',
        'legend',
        'xAxisLabels',
      ],
      props: [
        'font',
        'font-style',
        'font-weight',
        'font-size',
        'font-family',
        'color',
      ],
    },
  ],
}

//==============================================================================
// General helper functions for arrays

//------------------------------------------------------------------------------
// Collapse an array of arrays based on a reducing function

function collapseArray(array, func, init) {
  return array.map((subArray) => {
    return subArray.reduce(func, init)
  })
}

//------------------------------------------------------------------------------
// Sets of reducing functions with initial values

const toSum = [(acc, elem) => acc + elem, 0]
const toMax = [(acc, elem) => Math.max(acc, elem), -Infinity]
const toMaxLength = [(acc, elem) => Math.max(acc, elem.length), 0]

//------------------------------------------------------------------------------
// Pad an array with a value, up to a given length

const padArray = function (array, value, paddedLength) {
  for (let i = array.length; i < paddedLength; i++) array.push(value)
}

//==============================================================================
// General helper functions for objects

//------------------------------------------------------------------------------
// Predicate to test if a variable is an object

function isObject(obj) {
  return Object.prototype.toString.call(obj) === '[object Object]'
}

//------------------------------------------------------------------------------
// Merge a single branch into an object

function mergeBranch(obj, branch) {
  if (branch === undefined || branch.length === 0) return obj
  const keys = branch.slice().reverse()
  const value = keys.shift()
  let sub = obj
  let key = keys.pop()

  // Advance until key not found or value not an object
  while (key in sub && isObject(sub[key])) {
    sub = sub[key]
    key = keys.pop()
  }

  // Then build branch backwards and attach
  sub[key] = keys.reduce((branch, key) => {
    return { [key]: branch }
  }, value)
  return obj
}

//------------------------------------------------------------------------------
// Copy a set of keys and properties from an object

function copyFromObject(source, keys, props) {
  return keys.reduce((output, key) => {
    output[key] = props.reduce((sub, prop) => {
      if (prop in source[key]) sub[prop] = source[key][prop]
      return sub
    }, {})
    return output
  }, {})
}

//------------------------------------------------------------------------------
// Expand dotted keys to nested objects
//
// Only processes keys at a depth of 1.

function expandObject(options) {
  return Object.entries(options).reduce((expanded, entry) => {
    const [key, value] = [...entry]
    mergeBranch(expanded, [...key.split('.'), value])
    return expanded
  }, {})
}
