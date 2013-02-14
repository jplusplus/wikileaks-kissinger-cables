(function(window, jQuery, undefined) {    
    "use strict"

    // GLOBAL VARIABLES
    // -------------------------------------------------------------------------
    var $tip = $(".tip"),
       graph = "#graph",
      $graph = $(graph); 

    // Global data object
    var  data = {},
    // Visualization
          svg = null,
    // Indicator attrbute
    indicator = "part",
    // Graph sizes
    sizes = {
        margin : {top: 60, right: 40, bottom: 30, left: 40},
        width  : 0,
        height : 0
    };
    // -------------------------------------------------------------------------



    /**
     * Axis ranges on X
     * @type {Function}
     */
    var x = d3.time.scale();

    /**
     * Axis ranges on Y
     * @type {Function}
     */
    var y = d3.scale.linear();

    /**
     * Y axis function
     * @type {Function}
     */
    var yAxis = d3.svg.axis().scale(y).orient("left");

    /**
     * Interpolated line function
     * @type {Function}
     */
    var line = d3.svg
        .line().interpolate("basis")
            .x(function(d) { return x(d.dt); })
            .y(function(d) { return y(d[indicator]); });

    /**
     * Configure the color set and return the color
     * @type    {Function}
     * @return  {String}
     */
    var color = d3.scale.category10();

    /**
     * Parse the date with the given format
     * @param   {String}      String to parse
     * @type    {Function}
     */
    var parseDate = d3.time.format("%Y%m%d").parse;

    /**
     * Find the index of the element matching to the given date
     * @type {Function}
     * @param  {Array}      Collection where look for
     * @param  {Date}       Date to look for
     * @return {Integer}    Element index
     */
    var bisectDate = d3.bisector(function(d) { return d.dt; }).left;

    /**
     * Format the given date
     * @param   {Date}      Date to format
     * @type    {Function}
     */
    var formatDate = d3.time.format.utc("%Y-%m-%d%");


    /**
     * Creates the SVG
     * @return {Object} Created svg
     */
    function getNewSvg() {

        // Remove the existing SVGs
        d3.select("svg").remove();

        // Create a new one in the graph space
        return d3.select(graph).append("svg")
            .attr("width", sizes.width + sizes.margin.left + sizes.margin.right)
            .attr("height", sizes.height + sizes.margin.top + sizes.margin.bottom)
            .append("g")
                .attr("transform", "translate(" + sizes.margin.left + "," + sizes.margin.top + ")");
    }

    /**
     * Adjust Graph sizes to its parent size
     * @param {Boolean} redraw If true redraws the graph
     * @return {Object} Sizes
     */
    function adjustSizes(redraw) {
        
        // Calculates the graph sizes
        sizes.width  = $graph.innerWidth() - sizes.margin.left - sizes.margin.right,
        sizes.height = 450 - sizes.margin.top - sizes.margin.bottom;

        if(redraw === true) {
            // Update the axis ranges
            adjustRanges();
            // Create a new SVG (with the new size)
            svg = getNewSvg();
            // Update the visualization
            createGraph();
        }

        return sizes;
    }

    /**
     * Adjust the axis to the graph sizes
     * @return {Object} Sizes
     */
    function adjustRanges() {
        x.range([0, sizes.width]);
        y.range([sizes.height, 0]);   
        return sizes;     
    }

    function resizeGraph() {
        adjustSizes(true);
    }

    /**
     * Create the graph using the given data
     * @param  {Object} error Equals null if no error
     * @param  {Object} d     (Optional) Data series
     */
    function createGraph(error, d) {

        // Error happens
        if(error || d&&d.error) return alert("Impossible to create the visualization!");

        // Save data in the global namespace
        if(d) {
            data =  _.map(d, function(values, ngram) {          
                // Prepare values items
                var values = _.map(values, function(item) {     
                    // Parse the given date    
                    console.lo            
                    item.dt = parseDate(item.dt);
                    return item;
                });

                return {name: ngram, values: values};
            });
        }
     
        // Use the first line to extend the X axis 
        // (both datasets are the same on X)
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
                // Create the axis
                .call(yAxis);

        // Add rulers groups  along side Y Axis
        var yrule = svg.selectAll("g.y.axis")
            .data(y.ticks(10))
            .enter().append("svg:g")
                .attr("class", "y ruler");

        // Creates the rulers
        yrule.append("line")
            .attr("x1", 0).attr("x2", sizes.width)
            .attr("y1", y).attr("y2", y);

    
        var ngram = svg.selectAll(".ngram")
            .data(data)
            .enter()
                .append("g")
                    .attr("class", "ngram");

        ngram.append("path")
            .attr("class", "line")
            .attr("d", function(d) { return line(d.values); })
            .style("stroke", function(d) {  return color(d.name); });

        var focus = svg.selectAll(".focus")
            .data(data)
            .enter()
                .append("g")
                    .attr("class", "focus")
                    .style("display", "none");

        var focusRuler = focus.append("line")
            .attr("class", "focusRuler")            
            .attr("x1", x).attr("x2", x)
            .attr("y1", 0).attr("y2", sizes.height);

        svg.append("rect")
            .attr("class", "overlay")
            .attr("width", sizes.width)
            .attr("height", sizes.height)
            .on("mouseover", function() { focus.style("display", null); })
            .on("mouseout", function() { 
                $tip.addClass("hidden");
                focus.style("display", "none"); 
            })
            .on("mousemove", mousemove);

        /**
         * Local mousemove function to create a tooltip and and a ruler
         * @param  {Object} ev Mouse event
         */
        function mousemove(ev) {
            
            var date = x.invert(d3.mouse(this)[0]),
                  tx = d3.mouse(this)[0];

            var content = ["<h4>" + formatDate(date) + "</h4>"];     

            $.each(data, function(index, d) {   
                if(d) {            
                    var val = bisectDate(d.values, date),                     
                         bg = color(d.name);
                    content.push("<div>");
                        content.push("<span class='label right10' style='background:" + bg + "'>");
                            content.push(d.name);
                        content.push("</span>");                        
                        content.push("<span class='pull-right'>");
                            content.push( d.values[val]["ct"] + " occurence(s)"  );
                        content.push("</span>");                        
                    content.push("</div>");
                }
            });

            var onRight = d3.event.pageX > $(window).width()/2;
            $tip.html( content.join("") );
            $tip.css({
                "top": d3.event.pageY - $tip.outerHeight()/2,
                "left": onRight ? "auto" : d3.event.pageX,
                "right": onRight ? $(window).width() - d3.event.pageX  : "auto"
            }).removeClass("hidden").toggleClass("right",  onRight);


            focusRuler.attr("transform", "translate(" + tx + ", 0)");
        }

    }


    /**
     * Function to launh the research 
     * @param  {Object|String} ev   Optional triggered event or string to search
     * @return {Boolean}            Always false to prevent IE bug
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


    /**
     * Graph initialization
     */
    (function init() {        
        // Adjust the graph sizes
        adjustSizes();
        adjustRanges();
        svg = getNewSvg();

        // Search form events
        $("#search").submit(launchSearch);
        // Graph resizing
        $(window).resize(resizeGraph);
        
        launchSearch("nixon,watergate");
    })();


})(window, $);