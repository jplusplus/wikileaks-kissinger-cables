(function(window, jQuery, undefined) {    
    "use strict"


    // Global data object
    var  data = {},
    // Indicator attrbute
    indicator = "part";

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
    var yAxis = d3.svg.axis().scale(y).orient("right");

    // Interpolated line
    var line = d3.svg.line().interpolate("basis")
        .x(function(d) { return x(d.dt); })
        .y(function(d) { return y(d[indicator]); });

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
    launchSearch("nixon,watergate");


    /**
     * Create the graph using the given data
     * @param  {Object} error Equals null if no error
     * @param  {Object} d     (Optional) Data series
     */
    function createGraph(error, d) {

        // Error happens
        if(error || d.error) return alert("Impossible to create the visualization!");

        // Save data in the global namespace
        if(d) data = d;

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
            d3.min(data, function(c) { return d3.min(c.values, function(v) { return v[indicator]; }); }),
            d3.max(data, function(c) { return d3.max(c.values, function(v) { return v[indicator]; }); })
        ]);


        // Remove everything in the current graph
        svg.selectAll("g").remove();
    
        // Creates Y Axis group
        svg.append("g")
                .attr("class", "y axis")
                .attr("dy", -16)
                // Create the axis
                .call(yAxis)
                // Append tick text to along side the axis
                .append("text")
                    .attr("transform", "rotate(-90)")
                    .attr("y", -16)
                    .attr("dy", ".71em")
                    .style("text-anchor", "end")
                    .text("Occurences / Documents number");                       

        // Add rulers groups  along side Y Axis
        var yrule = svg.selectAll("g.y.axis")
            .data(y.ticks(10))
            .enter().append("svg:g")
            .attr("class", "y ruler");

        // Creates the rulers
        yrule.append("svg:line")
            .attr("x1", 0)
            .attr("x2", width)
            .attr("y1", y)
            .attr("y2", y);

    
        var ngram = svg.selectAll(".ngram")
            .data(data)
            .enter().append("g")
            .attr("class", "ngram");

        ngram.append("path")
            .attr("class", "line")
            .attr("d", function(d) { return line(d.values); })
            .style("stroke", function(d) {  return color(d.name); })
            .on("mouseover", console.log)


        ngram.append("text")
            .datum(function(d) { return {name: d.name, value: d.values[d.values.length - 1]}; })
            .attr("transform", function(d) { return "translate(" + x(d.value.dt) + "," + y(d.value[indicator]) + ")"; })
            .attr("x", 3)
            .attr("y", -16)
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

        if(typeof ev == "object") {
            // Get the query to look for
            var q = $(this).find(":input[name=q]").val();
            ev && ev.preventDefault();        
        } else if(typeof ev == "string") {
            var q = ev;
        }
        
        d3.json("/count/ngrams.json?q="+q, createGraph);
        return false;
    }


})(window, $);