
const default_options = {
  title_font: 'Open Sans',
  title_color: 'black',
  bar_width: 1,
  bar_spacing: 1,
  bar_color: 'red',
  values_show: true,
  values_color: 'green',
  values_position: 'top',
  labels_show: true,
  labels_color: 'blue',
  x_axis: true,
  y_axis: true,
  y_axis_ticks: 10

}

function drawBarChart(data, options, element) {
  console.log('Function: drawBarChart()')

  const chart = $('<div id="chart"></div>').appendTo(element)

  data.map(v => { drawOneBar(chart, options) })

}

function drawOneBar(element, options) {
  $('<div id="bar1"></div>')
    .appendTo(element)
    .css(options)
  //$('#bar1')
}

const data = [1, 2, 3]

const options = {
  display: 'inline-block',
  'background-color': 'green',
  width: "50px",
  height: "50px",
  bar_width: 1,
  bar_spacing: 1,
  bar_color: 'red',
}
