(function($, window, undefined) {

    // Embed form auto focus
    $(".sharespace.embed").on("focus mouseenter", "input", function() {
        this.select();
    });

})(jQuery, window);