/**
 * Draw a bar chart inside an html element.
 *
 * @param {Array<number> | Array<Array<number>>} data
 * @param {Object<string, number | string} options
 * @param {jQuery} element
 */

function drawBarChart(data, options, element) {
  const settings = processOptions(options, defaults, translationPattern)
  const processedData = processData(data)
  drawChart(element, processedData, settings)
  applyClasses(processedData, settings)
}

// chart        [css]: width height font color background-color
// title        text draw [css]: font color
// yAxisTitle   text draw [css]: font color
// yAxisLabels  draw precision [css]: font color
// gridlines    draw interval(top | center | bottom) color
// bars         colors gaps
// values       draw position precision [css]: font color
// legend       text draw [css]: font color
// xAxisLabels  text draw [css]: font color ff8

//------------------------------------------------------------------------------
// Helper functions for arrays

function collapseArray(array, func, init) {
  return array.map((arr) => {
    return arr.reduce(func, init)
  })
}

const toSum = [(acc, elem) => acc + elem, 0]
const toMax = [(acc, elem) => Math.max(acc, elem), -Infinity]
const toMaxLength = [(acc, elem) => Math.max(acc, elem.length), 0]

const padArray = function (array, value, paddedLength) {
  for (let i = array.length; i < paddedLength; i++) array.push(value)
}

//------------------------------------------------------------------------------
// Helper functions for objects

function isObject(obj) {
  return Object.prototype.toString.call(obj) === '[object Object]'
}

function mergeBranch(path, value, obj) {
  const keys = path.reverse()
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

function expandObject(options) {
  return Object.entries(options).reduce((expanded, entry) => {
    const [key, value] = [...entry]
    mergeBranch(key.split('.'), value, expanded)
    return expanded
  }, {})
}

const mergeObjects =
  (pattern) =>
  (firstObject, ...objects) => {
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

//------------------------------------------------------------------------------
// Process the options

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
        mergeBranch([id, prop], options[id][prop], translated)
      } else if (type === 'css') {
        mergeBranch([id, 'css', prop], options[id][prop], translated)
      }
    }
  }
  return translated
}

function processOptions(options, defaults, pattern) {
  const validated = validateOptions(expandObject(options), pattern)
  return $.extend(true, {}, defaults, validated)
}

//------------------------------------------------------------------------------
// Process the data

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

//------------------------------------------------------------------------------
// Helper function to merge settings

const mergeSettings = mergeObjects({
  classes: (a, b) => a + ' ' + b,
  text: (a, b) => b,
  css: (a, b) => ({ ...a, ...b }),
})

//------------------------------------------------------------------------------
// Helper function to create a DIV node in the DOM

function appendDiv(parent, ...props) {
  const merged = mergeSettings({ css: {} }, ...props) // css property not empty
  return $('<div></div>')
    .appendTo(parent)
    .addClass(merged.classes)
    .css(merged.css)
    .text(merged.text)
}

//------------------------------------------------------------------------------
// Draw the chart

function barsGridTemplate(data, settings) {
  const cnt = data.barCount
  const [l, i, r] = settings.bars.gaps
  return (
    `[gridlines-start] ${l} ` +
    `repeat(${cnt - 1}, [bars-start] 1fr ${i}) [bars-start] 1fr ` +
    `${r} [gridlines-end]`
  )
}

function chartGridTemplate(settings, ids, direction) {
  // Concatenate grid template from an array of elements
  return ids
    .filter((id) => settings[id].draw)
    .map((id) => settings[id][direction])
    .join(' ')
}

function drawChart(element, data, settings) {
  settings.bars.width = barsGridTemplate(data, settings) // mutates
  const grid_template_columns = chartGridTemplate(
    settings,
    ['yAxisTitle', 'yAxisLabels', 'bars', 'legend'],
    'width'
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
      const color = `color${data.is2D ? subBarIndex : barIndex}`
      const classes = `${setting.position} middle ${color}`
      const css = { 'grid-row': data.subBarCount + 1 - subBarIndex }
      const value = appendDiv(bar, setting, { classes, css })
      // Only post value if enough space
      if (setting.draw && value.height() > setting.minHeight)
        value.text(v.toFixed(setting.precision))
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
        `repeating-linear-gradient(to top, ${color} 0, ${color} 1px, ` +
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

//------------------------------------------------------------------------------
// Apply css to classes

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

//------------------------------------------------------------------------------
// Defaults and settings

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
    height: '3em',
    text: 'Chart title',
    classes: 'title middle top',
    css: {
      'font-size': '140%',
      'grid-column': '1 / -1',
      'grid-row': '1',
    },
  },
  yAxisTitle: {
    draw: true,
    width: '2.5em',
    classes: 'yAxisTitle middle top',
    text: 'Y axis title',
    css: {
      'writing-mode': 'vertical-rl',
      transform: 'rotate(180deg)',
      'grid-column': '1',
      'grid-row': 'bars-start / -1',
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
    interval: 2.4,
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

const translationPattern = {
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
