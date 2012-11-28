
var startingRender = {
  ids: ['time', 'delay', 'delay-time', 'time-day', 'day'],
  filter: {'delay': [20, 150]},
  given: {'delay-time': 'xc'},
  filterLevels: {'delay-time': [34, 76]},
};

datazooka.demo('flights', 'Flights', [
  startingRender,
  {
    ids: ['delay-distance', 'delay-time', 'delay'],
    given: {'delay-distance': 'xc'},
  },
  {
    ids: ['time', 'delay'],
  },
  {
    ids: ['time', 'delay'],
    filter: {'delay': [20, 150]},
    signals: [
      {under: '.filter.button', top: -5, left: -4},
    ],
  },
  {
    ids: ['time', 'delay'],
    filter: {'delay': [20, 150], 'time': [13, 24]},
    signals: [
      {under: '.chart-time', top: 20, left: 240},
      {under: 'span.percent-active', top: -3, right: 5},
    ],
  },
  {
    ids: ['delay-time', 'time', 'delay'],
    filter: {'delay-time': [10, 5, 14, 23]},
    signals: [
      {under: '.chart-delay-time', top: 24, left: 260},
      {under: '.chart-delay-time', top: 91, left: 185},
    ]
  },
  {
    ids: ['delay-time', 'time', 'delay'],
    filter: {'delay-time': [10, 5, 14, 23]},
    signals: [
      {under: '.chart-delay-time .given.button', top: -7, left: -5},
    ]
  },
  {
    ids: ['delay-time', 'time', 'delay'],
    given: {'delay-time': 'yc'},
  },
  {
    ids: ['delay-time', 'time', 'delay'],
    given: {'delay-time': 'xc'},
  },
  {
    ids: ['delay-time', 'time', 'delay'],
    given: {'delay-time': 'xc'},
    filterLevels: {'delay-time': [34, 70]},
    signals: [
      {under: '.chart-delay-time', top: 86, left: 558},
    ],
  },
  {
    ids: ['delay-day', 'time-day', 'day', 'delay'],
  },
  {
    ids: ['delay-day', 'time-day', 'day', 'delay'],
    filter: {'delay': [20, 150]},
  },
  {
    ids: ['delay-day', 'time-day', 'day', 'delay'],
    given: {'delay-day': 'xc'},
    filterLevels: {'delay-day': [26, 49]},
  },
  {
    ids: ['time-day', 'delay-day', 'day', 'delay'],
    filter: {'delay': [20, 150]},
    filterLevels: {'time-day': [48, 100]},
  },
  {
    ids: ['delay-distance', 'distance', 'delay'],
  },
  {
    ids: ['delay-distance', 'distance', 'delay'],
    given: {'delay-distance': 'yc'},
  },
  {
    ids: ['delay-distance', 'distance', 'delay'],
    given: {'delay-distance': 'xc'},
  },
  {
    ids: ['delay-distance', 'distance', 'delay'],
    given: {'delay-distance': 'xc'},
    filter: {'delay': [-60, 0]},
  },
  {
    ids: [],
    signals: [
      {under: '.remove-all.button', left: -5, top: -4},
    ],
  },
  {
    ids: ['delay-time', 'time'],
    signals: [
      {under: '.bar.button', left: -5, top: -4},
      {under: '.compare.button', left: -5, top: -4},
    ],
  },
  {
    ids: ['delay-time'],
    signals: [
      {under: '.remove', right: -3, top: 0},
    ],
  },
  startingRender,
  startingRender,
]);

datazooka.setup();

datazooka.definitions('flights', {
  time: {
    label: "Time of Day",
    derived: true,
    dimension: function(d) { return d.date.getHours() + d.date.getMinutes() / 60; }
  },
  delay: {
    label: "Arrival Delay (min.)",
    dimension: function(d) { return Math.max(-60, Math.min(149, d.delay)); }
  },
  distance: {
    label: "Distance (mi.)",
    dimension: function(d) { return Math.min(1999, d.distance); }
  },
  date: {
    label: "Date",
    type: function(d) { return new Date(2001, d.slice(0, 2) - 1, d.slice(2, 4), d.slice(4, 6), d.slice(6, 8)); },
    dimension: function(d) { return d3.time.day(d.date); },
    round: d3.time.day.round,
    groupIdentity: true,
    separation: 86400000,
    tickSpacing: 120,
    x: d3.time.scale().domain([new Date(2001, 0, 1), new Date(2001, 3, 1)]).range([0, 990])
  },
  day: {
    label: "Day of the Week",
    derived: true,
    dimension: function(d) { var day = d.date.getDay() - 1; if (day < 0) { return 6; } else { return day; } },
    ordinal: function(d) { return d; },
    format: function(d) { return ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'][d]; }
  },
  origin: {
    label: "Origin Airport",
    dimension: function(d) { return d.origin; },
    ordinal: function(d) { return d; },
  },
  destination: {
    label: "Destination Airport",
    dimension: function(d) { return d.destination; },
    ordinal: function(d) { return d; },
  },
});

d3.csv("/demos/flights.json", function(flights) {
  datazooka.dataFromUntyped('flights', flights);
});
