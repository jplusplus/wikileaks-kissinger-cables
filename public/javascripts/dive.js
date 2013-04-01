(function(window, jQuery, undefined) {    
    "use strict"

    // GLOBAL VARIABLES
    // -------------------------------------------------------------------------
    var $tip = $(".tip"),
       graph = "#graph",
      $graph = $(graph),
     $search = $("#search"),
      $types = $(".select-events-type"),
     $inspir = $(".need-inspiration a");

    // Global data object and events 
    var  data = {}, events = [],
    // Visualization
          svg = null,
    // Indicator attrbute
    indicator = "part",
    // Graph sizes
    sizes = {
        margin : {top: 60, right: 40, bottom: 10, left: 40},
        graphHeight : 250,
        width  : 0,
        height : 0,
        eventsY : 0,
        eventHeight : 15,
        eventMargin : 5,
        eventFontSize : "0.85em"
    };
    // An array of deactivated date ranges
    var deactivatedDateRanges = [
        { start: new Date(1975, 11, 1).getTime(), end: new Date(1975, 11, 15).getTime() },
        { start: new Date(1976, 2, 8).getTime(), end: new Date(1976, 3, 5).getTime() },
        { start: new Date(1976, 4, 25).getTime(), end: new Date(1976, 5, 7).getTime() }
    ];
    // -------------------------------------------------------------------------



    /**
     * Determines if the given data is defined according the global date range array
     * @param  {Object}  d Data object
     * @return {Boolean}   True if the data are defined
     */
    var isDefined = function(d) {
        
        var defined = true 
        $.each(deactivatedDateRanges, function(i, range) {
            if(defined) {
                defined = d.dt <= range.start || d.dt >= range.end;
            }
        })

        return defined;
    }


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
            .defined(isDefined)
            .x(function(d) { return x(d.dt); })
            .y(function(d) { return y(d[indicator]); });

    /**
     * Configure the color set for the graph
     * @type    {Function}
     * @return  {String}
     */
    var color = d3.scale.ordinal().range(["#B41316", "#3194AA", "#0DC100", "#850353", "#854103", "#ff7a33"]);

    /**
     * Configure the color set for events
     * @type    {Function}
     * @return  {String}
     */
    var colorEvent = d3.scale.ordinal().range(["#91e5b1","#e591a3","#91d6e5", "#F2DF80"]);


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
            .attr("height", sizes.height)
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
        //sizes.tolalEventsHeight = (sizes.eventHeight+sizes.eventMargin) * events.length                
        //sizes.height  = sizes.graphHeight + sizes.tolalEventsHeight;
        //sizes.height += sizes.margin.top + sizes.margin.bottom;
        sizes.height  = sizes.graphHeight
        sizes.height += $types.outerHeight(true);
        sizes.width   = $graph.innerWidth() - sizes.margin.left - sizes.margin.right;
        sizes.eventsY = sizes.graphHeight + sizes.margin.bottom + $types.outerHeight(true)

        // Redraw by default (if no parameter)
        if(redraw !== false) {
            // Update the axis ranges
            adjustRanges();
            // Create a new SVG (with the new size)
            svg = getNewSvg();
            // Update the visualization
            drawGraph();
        }

        return sizes;
    }

    /**
     * Adjust the axis to the graph sizes
     * @return {Object} Sizes
     */
    function adjustRanges() {
        x.range([0, sizes.width]);
        y.range([sizes.graphHeight, 0]);   
        return sizes;     
    }

    /**
     * Create the graph using the given data
     * @param  {Object} error Equals null if no error
     * @param  {Object} d     (Optional) Data series
     */
    function drawGraph(error, d) {

        // Error happens
        if(error || d&&d.error) return alert("Impossible to create the visualization!");

        // Save data in the global namespace
        if(d) {
            data =  _.map(d, function(values, ngram) {          
                // Prepare values items
                var values = _.map(values, function(item) {     
                    // Parse the given date    
                    item.dt = parseDate(item.dt);
                    return item;
                });

                return {name: ngram, values: values};
            });
        }

        // Colorize input tags
        $search.find(".tagsinput .tag").each(function(i) {
            var val = $(this).find("span").text().toUpperCase().trim();
            $(this).css("background-color", color( val ) );
        });
     
        // Use the first line to extend the X axis 
        // (both datasets are the same on X)
        x.domain(d3.extent(data[0].values, function(d) { return d.dt; }));

        y.domain([
            d3.min(data, function(c) { return d3.min(c.values, function(v) { return v[indicator]; }); }),
            d3.max(data, function(c) { return d3.max(c.values, function(v) { return v[indicator]; }); })
        ]);


        // Remove every line in the current graph
        svg.selectAll("g").remove();

        // Creates Y Axis group
        svg.append("g")                
                .attr("class", "y axis")
                // Create the axis
                .call(yAxis)
                    .append("text")
                        .attr("class", "label")
                        .attr("transform", "rotate(-90)")
                        .attr("y", 6)
                        .attr("dy", ".71em")
                        .style("text-anchor", "end")
                        .text("Proportion (%)");


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
            .style("stroke", function(d) {  
                return color(d.name);
            });       


        var focus = svg.selectAll(".focus")
            .data(data)
            .enter()
                .append("g")
                    .attr("class", "focus")
                    .style("display", "none");

        var focusRuler = focus.append("line")
            .attr("class", "focusRuler")            
            .attr("x1", x).attr("x2", x)
            .attr("y1", -40).attr("y2", sizes.height);


        // Add gray rect on deactivated dates range
        var blank = svg.append("g")
                        .attr("class", "blank")                
                        .selectAll(".blank")
                        .data(deactivatedDateRanges)
                        .enter()
                        .append("g")
                            .attr("class", "blank")
                            .append("rect")                        
                                .style("fill", "#eef")
                                .style("opacity", 0.4)
                                .attr("height", sizes.graphHeight)
                                .attr("width", function(d) {                                
                                    return x(d.end) - x(d.start);
                                })
                                .attr("x", function(d) {                                
                                    return x(d.start);
                                })
                                .attr("y", function(d, index) {                                
                                    return  0;
                                })


        svg.append("rect")
            .attr("class", "overlay")
            .attr("width", sizes.width)
            .attr("height", sizes.graphHeight)
            .on("mouseover", function() { focus.style("display", null); })
            .on("mouseout", function() { 
                $tip.addClass("hidden");
                focus.style("display", "none"); 
            })
            .on("mousemove", mousemove);



        // Add events on the graph
        drawEvents();


        /**
         * Local mousemove function to create a tooltip and and a ruler
         * @param  {Object} ev Mouse event
         */
        function mousemove(ev) {
            
            var date = x.invert(d3.mouse(this)[0]),
                  tx = d3.mouse(this)[0];

            var content = ["<h4>" + formatDate(date) + "</h4>"];     
            
            if( ! isDefined({dt: date} )) {
            
                content.push("<p>")
                    content.push("Documents missing for that period.")
                content.push("</p>")
                
            } else {

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
            }


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
        
        // Get the query to look for
        var q = $(this).val() || $search.find(":input[name=q]").val();                
        
        // No more than 3 terms
        if(q.split(",").length > 3) {
            $search.find(":input[name=q]").removeTag(ev);            
            // Alert the user
            alert("No more than 3 terms!")
        }

        if(q != undefined ) {

            // Loads the data
            d3.json("/count/ngrams.json?q="+escape(q), drawGraph);

            // Updates the search engine link
            var $link = $(".go-to-search a");            
            $link.attr("href", $link.data("href") + "?q=" + escape( q.replace(/,/g, "+") ) );
        } 

        return false;
    }

    function loadEvents(callback) {

        $.getJSON("/events.json", function(d) {
            // Parse dates
            events = _.map(d, function(ev) {
                ev.start_date = new Date(ev.start_date); 
                ev.end_date = new Date(ev.end_date); 
                return ev;
            });       

            // Sorts by date
            events = _.sortBy(events, function(ev) { return ev.start_date })
            // Finds the types
            var types = _.uniq( _.pluck(events, "type") );
            
            // Add the new types to the form
            $types.html("Event's categories: ");            
            $.each(types, function(index, type) {
                var $label = $("<span/>").addClass("active type label").html(type);
                $label.css("background-color", colorEvent(type) );
                $label.data("type", type);
                $types.append($label);
            });

            // Position the form
            $types.css({
                top: sizes.graphHeight + sizes.margin.bottom + sizes.margin.top                
            });

            return callback && callback(events);
        });
    }

    function drawEvents() {

        // Disable this feature
        return;

        // Remove every events in the current graph
        svg.selectAll("g.events").remove();
        
        // Only keep active events
        var eventsFiltered = _.filter(events, function(ev) {            
            return $types.find(".type.active").filter(function(idx, type) {
                return $(type).data("type") == ev.type;
            }).length > 0;
        });


        var ev = svg.append("g").attr("class", "events")                
                    .selectAll(".events")
                        .data(eventsFiltered)
                        .enter()
                        .append("g").attr("class", "event")   
                            .attr("transform", "translate(0," + sizes.eventsY + ")")
                            .append("a")
                                .attr("xlink:href", function(d) {return d.url})
                                .attr("target", "_blank");

        var rect = ev.append("rect")
                        .attr("rx",3)
                        .style("fill", function(d) { 
                            return colorEvent(d.type)
                        })
                        .attr("height", sizes.eventHeight)
                        .attr("width", function(d) {                                
                            return Math.max(6, x(d.end_date)-x(d.start_date) );
                        })
                        .attr("x", function(d) {                                
                            return x(d.start_date);
                        })
                        .attr("y", function(d, index) {                                
                            return  + index * (sizes.eventHeight+sizes.eventMargin);
                        })

        var label = ev.append("text")                        
                        .attr("transform", function(d, index) { 
                            
                            var tx = Math.max(0, x(d.start_date) ),
                                ty = index * (sizes.eventHeight+sizes.eventMargin);

                            return "translate(" + tx + "," + ty + ")"; 
                        })
                        .text(function(d) { return d.name })
                        .attr("x", 10)
                        .attr("dy", sizes.eventFontSize)
    }

    function toggleEvent(e) {
        $(this).toggleClass("active");
        drawEvents();
        e.preventDefault();
    }

    /**
     * Graph initialization
     */
    (function init() {     

        if(!Modernizr.svg) return;
        
        (function() {   
            // Adjust the graph sizes
            adjustSizes(false);
            adjustRanges();
            svg = getNewSvg();

            // Graph resizing
            $(window).resize(adjustSizes);
            // Events type toggle
            $types.delegate(".type", "click", toggleEvent);

            // Launch the search once
            launchSearch();

            // Tags system
            $search.find("[name=q]").tagsInput({
                height:'25px',
                width:'80%',
                defaultText:'add a term',
                maxChars : 25,
                onAddTag:  launchSearch,
                onRemoveTag:  launchSearch
            });

            // Search form events
            $search.on("submit", function(ev) {
                ev.preventDefault();
                launchSearch();
            });

            $inspir.on("click", function() {
                var t = $(this).text();
                $search.find("[name=q]").addTag(t);
            });
        })();

    })();


})(window, $);