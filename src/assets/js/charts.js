/* Renders Plotly charts placed by the {% chart %} shortcode.
 *
 * The post holds only the figure's data (exported from Python with
 * fig.write_json()). All site styling — typeface, oxblood accent, transparent
 * background, axis rules — is applied here, in one place, so charts stay
 * consistent and the Python that produces them stays short.
 *
 * Anything set explicitly in the Python layout wins over these defaults.
 */
(function () {
  "use strict";

  var nodes = document.querySelectorAll("[data-chart]");
  if (!nodes.length) return; // no charts on this page: load nothing

  var PLOTLY_SRC = "https://cdn.plot.ly/plotly-3.6.0.min.js";
  var ACCENT = "#6b1f2a"; // --accent
  var INK = "#1a1a1a"; // --ink

  var THEME = {
    font: {
      family: '"Palatine Parliamentary", Palatino, "Book Antiqua", Georgia, serif',
      size: 15,
      color: INK
    },
    paper_bgcolor: "rgba(0,0,0,0)", // sit directly on the grey paper
    plot_bgcolor: "rgba(0,0,0,0)",
    margin: { l: 50, r: 20, t: 20, b: 40 },
    xaxis: { showgrid: false, linecolor: "#d9d4c7", tickcolor: "#d9d4c7" },
    yaxis: { gridcolor: "#ece8df", zeroline: false },
    showlegend: false,
    height: 380
  };

  var CONFIG = { displayModeBar: false, responsive: true };

  // Fill in keys the author did not set. One level of nesting is enough for
  // Plotly layouts (font, xaxis, yaxis...).
  function withDefaults(given, defaults) {
    var out = given || {};
    Object.keys(defaults).forEach(function (key) {
      var fallback = defaults[key];
      if (out[key] === undefined) {
        out[key] = fallback;
      } else if (
        fallback && typeof fallback === "object" && !Array.isArray(fallback) &&
        out[key] && typeof out[key] === "object" && !Array.isArray(out[key])
      ) {
        Object.keys(fallback).forEach(function (inner) {
          if (out[key][inner] === undefined) out[key][inner] = fallback[inner];
        });
      }
    });
    return out;
  }

  // Give traces the house colour unless the author chose one.
  function styleTraces(data) {
    (data || []).forEach(function (trace) {
      if (trace.line && trace.line.color === undefined) trace.line.color = ACCENT;
      if (trace.line && trace.line.width === undefined) trace.line.width = 2.5;
      if (!trace.line && (trace.mode || "").indexOf("lines") !== -1) {
        trace.line = { color: ACCENT, width: 2.5 };
      }
      if (trace.marker && trace.marker.color === undefined) trace.marker.color = ACCENT;
      if (trace.type === "bar" && !trace.marker) trace.marker = { color: ACCENT };
    });
    return data;
  }

  function draw() {
    Array.prototype.forEach.call(nodes, function (node) {
      var source = node.querySelector('script[type="application/json"]');
      if (!source) return;

      var spec;
      try {
        spec = JSON.parse(source.textContent);
      } catch (err) {
        node.innerHTML = '<p class="caption">This chart’s data could not be read.</p>';
        return;
      }

      var target = document.createElement("div");
      node.appendChild(target);

      window.Plotly.newPlot(
        target,
        styleTraces(spec.data || []),
        withDefaults(spec.layout, THEME),
        CONFIG
      );
    });
  }

  if (window.Plotly) {
    draw();
  } else {
    var script = document.createElement("script");
    script.src = PLOTLY_SRC;
    script.charset = "utf-8";
    script.onload = draw;
    script.onerror = function () {
      Array.prototype.forEach.call(nodes, function (node) {
        node.innerHTML =
          '<p class="caption">This chart needs an internet connection to draw.</p>';
      });
    };
    document.head.appendChild(script);
  }
})();
