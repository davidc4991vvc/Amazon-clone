var express = require('express');
var router = express.Router();
var User = require('../models/user');
var twilio = require("twilio");
var client = new twilio.RestClient(process.env.TWILIO_ACCOUNT_ID, process.env.TWILIO_AUTH_TOKEN);

function randomCode() {
  var min = 1000;
  var max = 9999;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

module.exports = function(passport) {

  // GET registration page
  router.get('/register', function(req, res) {
    res.render('register');
  });

  // POST registration page
  var validateReq = function(userData) {
    return (userData.password === userData.passwordRepeat);
  };

  router.post('/register', function(req, res) {
    if (!validateReq(req.body)) {
      return res.render('register', {  //USE THIS FOR MORE ERROR NOTIFICATIONS LATER
        error: "Passwords don't match."
      });
    }

    if(req.body.password.length < 8){
      return res.render('register', {  //USE THIS FOR MORE ERROR NOTIFICATIONS LATER
        error: "Password must be at least 8 characters long."
      });
    }

    User.findOne({
      username: req.body.username
    }, function(error, user){
      if(error){
        return res.status(400).render('error', {
          message: error
        });
      } else if (user){
        return res.render('register', {  //USE THIS FOR MORE ERROR NOTIFICATIONS LATER
          error: "A user with that phone number already exists. Please register with a different phone number."
        });
      } else {
        var u = new User({
          username: req.body.username,
          password: req.body.password
        });

        u.save(function(error, user) {
          if(error){
            return res.status(400).render('error', {
              message: error
            });
          }
          var code = randomCode();
          // user.registrationCode === code; //do I need to findOneAndUpdate?
          User.findByIdAndUpdate(user._id, {
            registrationCode: code
          }, function(error, user){
              client.messages.create({
                body: code,
                to: req.body.username,  // Text this number
                from: process.env.TWILIO_FROM_NUMBER // From a valid Twilio number
                }, function(error, msg){
                  if(error){
                    return res.status(400).render('error', {
                      message: error
                    });
                  }
                  req.login(user, function(error) {
                    if(error){
                      return res.status(400).render('error', {
                        message: error
                      });
                    }
                    res.redirect('/verify');
                  });
                  //log the user in so that req.user exists before we check req.user.registrationCode
              });
          });
        });
      }
    });
  });

  // GET Login page
  router.get('/login', function(req, res) {
    if(req.user){
      res.redirect('/');
      return
    }
    res.render('login');
  });

  // POST Login page
  router.post('/login', passport.authenticate('local', { successRedirect: '/', failureRedirect: '/login' }));

  // GET Logout page
  router.get('/logout', function(req, res) {
    req.session.cart = [];
    req.logout();
    res.redirect('/login');
  });

  //facebook 
  router.get('/auth/facebook',
  passport.authenticate('facebook'));

  router.get('/auth/facebook/callback',
    passport.authenticate('facebook', { failureRedirect: '/login' }),
    function(req, res) {
      // Successful authentication, redirect home.
      res.redirect('/');
    });

  return router;
};
