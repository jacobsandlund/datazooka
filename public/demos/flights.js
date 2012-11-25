datazooka.setup();

datazooka.defaultRender('flights', ['time', 'delay', 'delay-time', 'time-day', 'day'], {
  filter: {'delay': [20, 150]}, given: {'delay-time': 'xc'}, filterLevels: {'delay-time': [34, 76]}
});

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
