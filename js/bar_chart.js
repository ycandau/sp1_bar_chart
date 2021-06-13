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
// yAxisLabels  draw [css]: font color
// gridlines    draw interval(top | center | bottom) color
// bars         colors gaps
// values       draw position [css]: font color
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

const mergeProps = mergeObjects({
  classes: (a, b) => a + ' ' + b,
  text: (a, b) => b,
  css: (a, b) => ({ ...a, ...b }),
})

//------------------------------------------------------------------------------
// Helper function to create a DIV node in the DOM

function appendDiv(parent, id, ...props) {
  const parent_obj = typeof parent === 'string' ? $('#' + parent) : parent
  const merged = mergeProps({ css: {} }, ...props)
  return $('<div></div>')
    .appendTo(parent_obj)
    .attr('id', id)
    .addClass(merged.classes)
    .css(merged.css)
    .text(merged.text)
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
  appendDiv(element, 'chart', settings.chart, { css })

  drawTitle(settings)
  drawYAxisTitle(settings)
  drawBars(data, settings)
  drawYAxisLabels(data, settings)
  drawGridlines(data, settings)
  drawLegend(data, settings)
  drawXAxisLabels(data, settings)
}

//------------------------------------------------------------------------------
// Draw the chart title

function drawTitle(settings) {
  if (settings.title.draw) appendDiv('chart', 'title', settings.title)
}

//------------------------------------------------------------------------------
// Draw the Y axis title

function drawYAxisTitle(settings) {
  if (settings.yAxisTitle.draw)
    appendDiv('chart', 'yAxisTitle', settings.yAxisTitle)
}

//------------------------------------------------------------------------------
// Draw the bars

function drawValues(barIndex, barValues, data, settings) {
  const values = settings.values
  barValues
    .slice(0, -1) // slice off the remainder value
    .forEach((v, subBarIndex) => {
      const parent = 'bar' + barIndex
      const color = `color${data.is2D ? subBarIndex : barIndex}`
      const classes = `${values.position} middle ${color}`
      const css = { 'grid-row': data.subBarCount + 1 - subBarIndex }
      const bar = appendDiv(parent, '', values, { classes, css })
      // Only post value if enough space
      if (values.draw && bar.height() > values.minHeight) bar.text(v.toFixed(0))
    })
}

function drawBars(data, settings) {
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
    appendDiv('chart', 'bar' + index, settings.bars, { css })
    drawValues(index, barValues, data, settings)
  })
}

//------------------------------------------------------------------------------
// Draw the Y axis labels

function drawYAxisLabels(data, settings) {
  if (settings.yAxisLabels.draw) {
    const height = $('#bar0').height()
    const interval = Math.round(
      height * (settings.gridlines.interval / data.max)
    )
    const count = Math.floor(height / interval) + 1
    const shift = (0.5 - count) * interval + height
    const grid_template_rows = `repeat(${count}, ${interval}px)`
    const css = {
      'grid-template-rows': grid_template_rows,
      top: `${shift}px`,
    }
    appendDiv('chart', 'yAxisLabels', settings.yAxisLabels, { css })

    for (let i = 0; i < count; i++) {
      const classes = 'middle center'
      const text = ((count - i - 1) * settings.gridlines.interval).toFixed(0)
      appendDiv('yAxisLabels', '', { classes, text })
    }
  }
}

//------------------------------------------------------------------------------
// Draw the gridlines

function drawGridlines(data, settings) {
  const gridlines = settings.gridlines
  if (gridlines.draw) {
    const height = $('#bar0').height()
    const distGridlines = Math.round(height * (gridlines.interval / data.max))
    const color = gridlines.color

    // Issue: Rounded pixel height causes cumulative error.
    // But decimal height causes occasionally thicker gridlines.
    const css = {
      background:
        `repeating-linear-gradient(to top, ${color} 0, ${color} 1px, ` +
        `transparent 1px, transparent ${distGridlines}px)`,
    }
    appendDiv('chart', 'gridlines', settings.gridlines, { css })
  }
}

//------------------------------------------------------------------------------
// Draw the legend

function drawLegend(data, settings) {
  const legend = settings.legend
  if (legend.draw && data.is2D) {
    const count = data.subBarCount
    const css = { 'grid-template-rows': `1fr repeat(${count}, 1.4em) 1fr` }
    const text = '' // reserve text for children
    appendDiv('chart', 'legend', settings.legend, { css, text })

    for (let i = 0; i < count; i++) {
      const classes = `middle center color${i}`
      const text = legend.text[i]
      const css = {
        padding: '0.1em 0.5em',
        'grid-row': `${count + 1 - i}`,
      }
      appendDiv('legend', '', { classes, text, css })
    }
  }
}

//------------------------------------------------------------------------------
// Draw the X axis labels

function drawXAxisLabels(data, settings) {
  const labels = settings.xAxisLabels
  if (labels.draw) {
    data.values.forEach((val, index) => {
      const text = labels.text[index]
      const css = { 'grid-column': `bars-start ${index + 1}` }
      appendDiv('chart', 'label' + index, labels, { css, text })
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
    classes: 'middle top',
    text: 'Chart title',
    css: {
      'font-size': '140%',
      'grid-column': '1 / -1',
      'grid-row': '1',
    },
  },
  yAxisTitle: {
    draw: true,
    width: '2.5em',
    classes: 'middle top',
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
    width: '[y-labels-start] 2em',
    css: {
      width: '2em',
      position: 'absolute',
      display: 'grid',
      'grid-column': 'y-labels-start',
      'grid-row': 'bars-start',
    },
  },
  bars: {
    draw: true,
    height: '[bars-start] 1fr',
    gaps: ['0.25fr', '0.5fr', '0.25fr'],
    colors: ['#fb09', '#f809', '#f409', '#f809'],
    css: {
      display: 'grid',
      'grid-row': 'bars-start',
      'z-index': 2,
    },
  },
  values: {
    draw: true,
    position: 'center',
    minHeight: 20,
    css: {
      padding: '2px 0',
    },
  },
  gridlines: {
    draw: true,
    interval: 2.4,
    color: '#fff6',
    css: {
      'grid-column': 'gridlines-start / gridlines-end',
      'grid-row': 'bars-start',
      'z-index': 1,
    },
  },
  legend: {
    draw: true,
    width: 'auto',
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
    classes: 'middle bottom',
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
    { ids: ['values'], props: ['position'] },
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
