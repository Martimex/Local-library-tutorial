const {body, validationResult} = require('express-validator');
var Book = require('../models/book');
var Author = require('../models/author');
var Genre = require('../models/genre');
var BookInstance = require('../models/bookinstance');

var async = require('async');
const { syncIndexes } = require('../models/book');

exports.index = function (req, res) {

    async.parallel({
        book_count: function(callback) {
            Book.countDocuments({}, callback); // Przekaż pusty obiekt jako warunek dopasowania, aby znaleźć wszystkie elementy z tej kolekcji
        },
        book_instance_count: function(callback) {
            BookInstance.countDocuments({}, callback);
        },
        book_instance_available_count: function(callback) {
            BookInstance.countDocuments({status: 'Available'}, callback);
        },
        author_count: function(callback) {
            Author.countDocuments({}, callback);
        },
        genre_count: function(callback) {
            Genre.countDocuments({}, callback);
        }
    }, function(err, results) {
            res.render('index', {title: 'Local Library Home', error: err, data: results });
    });
};

//Wyświetl listę wszystkich Books
exports.book_list = function(req, res, next) {

    Book.find({}, 'title author')
      .populate('author')
      .exec(function (err, list_books) {
        if (err) { return next(err); }
        //Successful, so render
        res.render('book_list', { title: 'Book List', book_list: list_books });
      });
  
  };

//Wyświetl szczegółową stronę dla konkretnej Book
exports.book_detail = function(req, res, next) {
    
    async.parallel({
        book: function(callback) {

            Book.findById(req.params.id)
                .populate('author')
                .populate('genre')
                .exec(callback);
        },
        book_instance: function(callback) {

            BookInstance.find({'book': req.params.id})
            .exec(callback);
        },

    }, function(err, results) {
        if(err) {return next(err); }
        if(results.book==null) { // No results
            var err= new Error('Book not found');
            err.status = 404;
            return next(err);
        }
        //Successful, so render
        res.render('book_detail', {title: results.book.title, book: results.book, book_instances: results.book_instance});
    });
};

//Wyświetl formularz tworzenia Book na GET
exports.book_create_get = function(req, res, next) {
    
    async.parallel({
        authors: function(callback) {
            Author.find(callback);
        },
        genres: function(callback) {
            Genre.find(callback);
        },       
    }, function (err, results) {
        if(err) {return next(err); }
        res.render('book_form', {title: 'Create Book', authors: results.authors, genres: results.genres});
    });
};

//Zajmij się tworzeniem Book na POST
exports.book_create_post = [
    // Convert Genre to Array
    (req, res, next) => {
        if(!(req.body.genre instanceof Array)) {
            if(typeof req.body.genre==='undefined')
            req.body.genre = [];
            else
            req.body.genre = new Array(req.body.genre);
        }
        next();
    },
    // Validate and sanitize fields
    body('title', 'Title must not be empty.').trim().isLength({min: 1}).escape(),
    body('author', 'Author must not be empty.').trim().isLength({min: 1}).escape(),
    body('summary', 'Summary must not be empty.').trim().isLength({min: 1}).escape(),
    body('isbn', 'ISBN must not be empty.').trim().isLength({min: 1}).escape(),
    body('genre.*').escape(),

    // Process request after validation and sanitization
    (req, res, next) => {

        // Extract validation errors from request
        const errors = validationResult(req);

        // Create Book object with escaped and trimmed data
        var book =  new Book(
        {   title: req.body.title,
            author: req.body.author,
            summary: req.body.summary,
            isbn: req.body.isbn,
            genre: req.body.genre
        });

        if(!errors.isEmpty()) {
            // There are errors. Render form again with sanitized values / error messages
            // Get all Authors and Genres for form
            async.parallel({
                authors: function(callback) {
                    Author.find(callback);
                },
                genres: function(callback) {
                    Genre.find(callback);
                },
            }, function(err, results) {
                if(err) {return next(err); }

                // Mark chosen Genres as checked
                for(let i=0; i<results.genres.length; i++)
                {
                    if(book.genre.indexOf(results.genres[i]._id) > -1) {
                        results.genres[i].checked ='true';
                    }
                }
                res.render('book_form', {title: 'Create Book', authors: results.authors, genres: results.genres, book: book, errors: errors.array()});
            });
            return;
        }
        else {
            // Data from form is valid. Save Book
            book.save(function (err) {
                if(err) {return next(err); }
                // Successful - redirect to new Book record
                res.redirect(book.url);
            });
        }
    }
];

//Wyświetl formularz usuwania na GET
exports.book_delete_get = function(req, res,next) {
    
    async.parallel({
        book: function(callback) {
            Book.findById(req.params.id).exec(callback);
        },
        books_instances: function(callback) {
            BookInstance.find({ 'book': req.params.id}).exec(callback);
        },
    }, function (err, results) {
        if (err) {return next(err); }
        if (results.book == null) { // No results
            res.redirect('/catalog/books')
        }
        // Successful, so render
        res.render('book_delete', {title: 'Delete Book', book: results.book,  books_instances: results.books_instances });
    });
};

//Zajmij się usuwaniem Book na POST
exports.book_delete_post  = function(req, res, next) {
    
    async.parallel({
        book: function(callback) {
            Book.findById(req.body.bookid).exec(callback);
        },
        books_instances: function(callback) {
            BookInstance.find({ 'book': req.body.bookid }).exec(callback);
        },
    }, function (err, results) {
        if(err) {return next(err); }
        // Success
        if(results.books_instances.length > 0) {
            // Book has BookInstances. Render in the same way as for GET route
            res.render('book_delete', {title: 'Delete Book', book: results.book,  books_instances: results.books_instances });
            return;
        }
        else {
            // Books has no BookInstances. Delete Book and redirect to the list of books
            Book.findByIdAndRemove(req.body.bookid, function deleteBook(err) {
                if(err) {return next(err); }
                // Success - go to book list
                res.redirect('/catalog/books')
            })
        }
    });
};

//Wyświetl formularz aktualizacji Book na GET
exports.book_update_get = function(req, res, next) {
    
    // Get book, authors and genres for forms
    async.parallel({
        book: function(callback) {
            Book.findById(req.params.id).populate('author').populate('genre').exec(callback);
        },
        authors: function(callback) {
            Author.find(callback);
        },
        genres: function(callback) {
            Genre.find(callback);
        },
    }, function(err, results) {
        if(err) {return next(err); }
        if(results.book == null) { // No results 
            var err = new Error ('Book not found');
            err.status = 404;
            return next(err);
        }
        // Success
        // Mark chosen genres as checked
        for(var all_g_iter=0; all_g_iter < results.genres.length; all_g_iter++) {
            for(var book_g_iter=0; book_g_iter < results.book.genre.length; book_g_iter++) {
                if(results.genres[all_g_iter]._id.toString() === results.book.genre[book_g_iter]._id.toString()) {
                    results.genres[all_g_iter].checked = 'true';
                }
            }
        }
        res.render('book_form', {title: 'Update Book', authors: results.authors, genres: results.genres, book: results.book});
    });
};

//Zajmij się aktualizowaniem Book na POST
exports.book_update_post = [

    // Convert genre to an array
    (req, res, next) => {
        if(!(req.body.genre instanceof Array)) {
            if(typeof req.body.genre === 'undefined')
            req.body.genre = [];
            else
            req.body.genre = new Array(req.body.genre);
        }
        next();
    },

    // Validate and sanitize fields
    body('title', 'Title must not be empty.').trim().isLength({min: 1}).escape(),
    body('author', 'Author must not be empty.').trim().isLength({min: 1}).escape(),
    body('summary', 'Summary must not be empty.').trim().isLength({min: 1}).escape(),
    body('isbn', 'ISBN must not be empty').trim().isLength({min: 1}).escape(),
    body('genre.*').escape(),

    // Process request after validation and sanitization
    (req, res, next) => {

        // Extract validation errors from request
        const errors = validationResult(req);

        // Create Book object with escaped and trimmed data
        var book = new Book ({
            title: req.body.title,
            author: req.body.author,
            summary: req.body.summary,
            isbn: req.body.isbn,
            genre: (typeof req.body.genre === 'undefined') ? [] : req.body.genre,
            _id: req.params.id // This is required, or a new ID will be assigned!
        });

        if(!errors.isEmpty()) {
            // There are errors. Render form again with sanitized values / error messages
            
            // Get all authors and genres for form
            async.parallel({
                authors: function(callback) {
                    Author.find(callback);
                },
                genres: function(callback) {
                    Genre.find(callback);
                },
            }, function(err, results) {
                if(err) {return next (err); }

                // Mark chosen genres as checked
                for(let i=0; i<results.genres.length; i++) {
                    if(book.genre.indexOf(resluts.genres[i]._id > -1)) {
                        results.genres[i].checked = 'true';
                    }
                }
                res.render('book_form', {title: 'Update Book', authors: results.authors, genres: results.genres, book:book, errors: errors.array()});
            });
            return;
        }
        else {
            // Data from form is valid. Update the record
            Book.findByIdAndUpdate(req.params.id, book, {}, function(err, thebook) {
                if(err) {return next(err); }
                // Successful - redirect to Book's detail page
                res.redirect(thebook.url);
            });
        }
    }
];