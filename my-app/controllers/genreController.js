const {body, validationResult} = require('express-validator');
var Book = require('../models/book');
var async = require('async');
var Genre = require('../models/genre');
//var mongoose = require('mongoose');

//Wyświetl listę wszystkich Genre
exports.genre_list = function(req, res, next) {
    
    Genre.find()
        .sort([['name', 'ascending']])
        .exec(function (err, list_genres) {
            //Successful, so render
            res.render('genre_list', {title: 'Genre List', genre_list: list_genres});
        })
};

//Wyświetl szczegółową stronę dla konkretnego Genre
exports.genre_detail = function(req, res, next) {
    //var id = mongoose.Types.ObjectId(req.params.id);
    
    async.parallel({
        genre: function(callback) {
            Genre.findById(req.params.id)
                .exec(callback);
        },
        genre_books: function(callback) {
            Book.find({'genre': req.params.id})
                .exec(callback);
        },

    }, function (err, results) {
        if(err) {return next(err); }
        if(results.genre==null) { // No results
            var err = new Error('Genre not found');
            err.status = 404;
            return next(err);
        }   
        // Successful, so render
        res.render('genre_detail', {title: 'Genre Detail', genre: results.genre, genre_books: results.genre_books});
    });
};

//Wyświetl formularz tworzenia Genre dla GET
exports.genre_create_get = function(req, res, next) {
    res.render('genre_form', {title: 'Create Genre'});
};

//Zajmij się tworzeniem Genre na POST
exports.genre_create_post = [

    // Validate and sanitize 'name' field
    body('name', 'Genre name required').trim().isLength({min: 1}).escape(),

    // Process request after validation and sanitization
    (req, res, next) => {

        // Extract validation errors from request
        const errors = validationResult(req);

        //Create Genre object with escaped and trimmed data
        var genre = new Genre(
            {name: req.body.name}
        );

        if(!errors.isEmpty()) {
            // There are some errors. Render the form again with sainitized values / error messages
            res.render('genre_form', {title: 'Create Genre', genre: genre, errors: errors_array()});
            return;
        }
        else {
            // Data from form is valid
            // Check if Genre with the same name exists
            Genre.findOne({'name': req.body.name})
            .exec(function(err, found_genre) {
                if(err) {return next(err); }

                if(found_genre) {
                    // Genre exists, redirect to Genre detail site
                    res.redirect(found_genre.url);
                }
                else {
                    genre.save(function (err) {
                        if(err) {return next (err);}
                        // Genre saved, redirect to Genre detail site
                        res.redirect(genre.url);
                    });
                }
            });
        }
    }
];

//Wyświetl formularz usuwania Genre na GET
exports.genre_delete_get = function(req, res, next) {
    
    async.parallel({
        genre: function(callback) {
            Genre.findById(req.params.id).exec(callback)
        },
        genres_books: function(callback) {
            Book.find({'genre': req.params.id}).exec(callback)
        },
    }, function(err, results) {
        if(err) {return next(err); }
        if (results.genre == null) { // No results
            res.redirect('/catalog/genres');
        }
        // Successful, so render
        res.render('genre_delete', {title: 'Delete Genre', genre: results.genre, genres_books: results.genres_books});
    });
};

//Zajmij się usuwaniem Genre na POST
exports.genre_delete_post = function(req, res, next) {
    
    async.parallel({
        genre: function(callback) {
            Genre.findById(req.body.genreid).exec(callback)
        },
        genres_books: function(callback) {
            Book.find({ 'genre': req.body.genreid}).exec(callback)
        },
    }, function (err, results) {
        if (err) {return next (err); }
        // Success
        if (results.genres_books.length > 0) {
            // Genre has books. Render in the same way as for GET route
            res.render('genre_delete', {title: 'Delete Genre', genre: results.genre, genre_books: results.genres_books});
            return;
        }
        else {
            // Genre has not Books. Delete object and redirect to genre list
            Genre.findByIdAndRemove(req.body.genreid, function deleteGenre (err) {
                if (err) {return next (err); }
                // Success - go to the genre list
                res.redirect('/catalog/genres')
            })
        }
        
    });
};

//Wyświetl formularz aktualizacji Genre na GET
exports.genre_update_get = function(req, res, next) {
    
    // Get Genre for form
    async.parallel({
        genre: function(callback) {
            Genre.findById(req.params.id).exec(callback);
        },
    }, function (err, results) {
        if (err) {return next(err); }
        if(results.genre == null) { // No results
            var err = new Error('Genre not found');
            err.status = 404;
            return next(err);
        }
        // Success
        res.render('genre_form', {title: 'Update Genre', genre: results.genre});
    });
};

//Zajmij się aktualizowaniem Genre na POST
exports.genre_update_post = [

    // Validate and sanitize fields
    body('name', 'Genre name required').trim().isLength({min: 1}).escape(),

    // Process request after validation and sanitization
    (req, res, next) => {

        // Extract validation errors from request
        const errors = validationResult(req);

        // Create Genre object with escaped and trimmed data
        var genre = new Genre({
            name: req.body.name,
            _id: req.params.id // This is required, or new ID will be assigned!
        });

        if(!errors.isEmpty()) {
            // There are errors. Render form again with sanitized data / error messages

            // Get all Genres - idk why
            async.parallel({
                genre: function(callback) {
                    Genre.find(callback)
                },    
            }, function (err, results) {
                if(err) {return next(err); }

                res.render('genre_form', {title: 'Update Genre', genre: results.genre, errors: errors.array()});
            });
            return;
        }
        else {
            // Data from form is valid. Update record
            Genre.findByIdAndUpdate(req.params.id, genre, {}, function (err, thegenre) {
                if(err) {return next(err); }
                // Successful - redirect to Genre's detail page
                res.redirect(thegenre.url)
            });
        }
    }

];