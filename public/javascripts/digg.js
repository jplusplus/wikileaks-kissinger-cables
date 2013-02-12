(function(window, jQuery, undefined) {    
    "use strict"

    /**
     * Create the graph using the given data
     * @param  {Object} error Equals null if no error
     * @param  {Object} data  Data series
     */
    function createGraph(error, data) {

        data = _.map(data, function(values, ngram) {          
            // Prepare values items
            var values = _.map(values, function(item) {     
                // Parse the given date                
                item.dt = parseDate(item.dt);
                return item;
            });

            return {name: ngram, values: values};
        });
     
        // Use the first line to extend the X axis
        x.domain(d3.extent(data[0].values, function(d) { return d.dt; }));

        y.domain([
            d3.min(data, function(c) { return d3.min(c.values, function(v) { return v.part; }); }),
            d3.max(data, function(c) { return d3.max(c.values, function(v) { return v.part; }); })
        ]);


        // Remove everything in the current graph
        svg.selectAll("g").remove();
    
        svg.append("g")
            .attr("class", "y axis")
            .call(yAxis)
            .append("text")
            .attr("transform", "rotate(-90)")
            .attr("y", 6)
            .attr("dy", ".71em")
            .style("text-anchor", "end")
            .text("Occurences");            
    
        var ngram = svg.selectAll(".ngram")
            .data(data)
            .enter().append("g")
            .attr("class", "ngram");

        ngram.append("path")
            .attr("class", "line")
            .attr("d", function(d) { return line(d.values); })
            .style("stroke", function(d) {  return color(d.name); });


        ngram.append("text")
            .datum(function(d) { return {name: d.name, value: d.values[d.values.length - 1]}; })
            .attr("transform", function(d) { return "translate(" + x(d.value.dt) + "," + y(d.value.part) + ")"; })
            .attr("x", 3)
            .attr("dy", ".35em")
            .style("text-anchor", "end")
            .style("fill", function(d) { return color(d.name); })
            .text(function(d) { return d.name; });
    }


    /**
     * Function to launh the research 
     * @param  {[type]} ev  Optional triggered event
     * @return {Boolean}    Always false to prevent IE bug
     */
    function launchSearch(ev) {
        // Get the query to look for
        var q = $(this).find(":input[name=q]").val();
        d3.json("/count/ngrams.json?q="+q, createGraph);

        ev && ev.preventDefault();
        return false;
    }

    // Graph dimension
    var margin = {top: 60, right: 20, bottom: 30, left: 25},
        width = $("#graph").innerWidth() - margin.left - margin.right,
        height = 500 - margin.top - margin.bottom;

    // Data parse function
    var parseDate = d3.time.format("%Y%m%d").parse;

    // Axis ranges
    var x = d3.time.scale().range([0, width]);
    var y = d3.scale.linear().range([height, 0]);

    // Y axis
    var yAxis = d3.svg.axis().scale(y).orient("left");

    // Interpolated line
    var line = d3.svg.line().interpolate("basis")
        .x(function(d) { return x(d.dt); })
        .y(function(d) { return y(d.part); });

    // Creates the SVG
    var svg = d3.select("#graph").append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
      .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    // Colors sets
    var color = d3.scale.category10();

    // Search form events
    $("#search").submit(launchSearch);

})(window, $);