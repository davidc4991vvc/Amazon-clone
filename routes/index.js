var express = require('express');
var router = express.Router();
var User = require('../models/user');
var Shipping = require('../models/shipping');
var Product = require('../models/product');
var mongoose = require('mongoose');
var twilio = require("twilio");
var client = new twilio.RestClient(process.env.TWILIO_ACCOUNT_ID, process.env.TWILIO_AUTH_TOKEN);
var stripe = require("stripe")(process.env.STRIPE_TEST_KEY);
var Payment = require('../models/payment');
var Order = require('../models/order');

function randomCode() {
  var min = 1000;
  var max = 9999;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// THE WALL - anything routes below this are protected!

router.use(function(req, res, next){
  if (!req.user) {
    return res.redirect('/login');
  } else {
    return next();
  }
});

router.get('/fb', function(req, res){
  if(req.user.username){
    return res.redirect('/');
  } else {
    res.render('fb');
  }
});

router.post('/fb', function(req, res, next){
  if(req.user.username){
    return res.redirect('/');
  } else {
    User.findByIdAndUpdate(req.user._id, {
      username: req.body.phone
    }, function(error, user){
      if(error){
        return res.status(400).render('error', {
          message: error
        });
      }
      client.messages.create({
        body: user.registrationCode,
        to: req.body.phone,  // Text this number
        from: process.env.TWILIO_FROM_NUMBER // From a valid Twilio number
        }, function(error, msg){
          if(error){
            return res.status(400).render('error', {
              message: error
            });
          }
          return next();
      });
    });
  } 
});

//FB WALL
router.use(function(req, res, next){
  if(!req.user.username){
    return res.redirect('/fb');
  } else {
    return next();
  }
});

router.get('/newCode', function(req, res, next){
  if(req.user.registrationCode === null){
    return res.redirect('/');
  } else {
    //generate new code, send to user via Twilio, redirect to /verify
    var code = randomCode();
    User.findByIdAndUpdate(req.user._id, {
      registrationCode: code
    }, function(error, user){
      client.messages.create({
        body: code,
        to: req.user.username,  // Text this number
        from: process.env.TWILIO_FROM_NUMBER // From a valid Twilio number
        }, function(error, msg){
          if(error){
            return res.status(400).render('error', {
              message: error
            });
          }
          res.redirect('/verify');
      });
    });
  }
});

router.get('/verify', function(req, res, next){
  if(req.user.registrationCode === null){
    return res.redirect('/');
  } else{
    res.render('verify');
  }
});

router.post('/verify', function(req, res, next){
  if(req.user.registrationCode === null){
    return res.redirect('/');
  } else {
    if(req.body.code === req.user.registrationCode){ //no req.user
      User.findByIdAndUpdate(req.user._id, {
        registrationCode: null
      }, function(error, user){
        if(error){
          return res.status(400).render('error', {
            message: error
          });
        }
       
        return next();
      });
    } else {
      res.redirect('/verify');
    }
  }
});

//SMS VERIFICATION WALL
router.use(function(req, res, next){
  if(req.user.registrationCode){ //no req.user
    res.redirect('/verify');
  } else {
    return next();
  }

});

router.get('/shipping', function(req, res, next){
  if(req.user.defaultShipping){
    return res.redirect('/');
  } else {
    res.render('shipping');
  }
})

router.post('/shipping', function(req, res) {
  if(req.user.defaultShipping){
    return res.redirect('/');
  } else {
    var s = new Shipping({
      name: req.body.name,
      address1: req.body.address1,
      address2: req.body.address2,
      city: req.body.city,
      state: req.body.state,
      zip: req.body.zipcode,
      phone: req.body.phone,
      status: 1, //change when implementing multiple shipping addresses
      parent: req.user._id
    });
    s.save(function(error, shipping) {
      if(error){
        return res.status(400).render('error', {
          message: error
        });
      }
      if(!req.user.defaultShipping){
        User.findByIdAndUpdate(req.user.id, {
          defaultShipping: shipping
        }, function(error){
          if(error){
            return res.status(400).render('error', {
              message: error
            });
          }
          res.redirect('/');
          
        });
      } else {
        res.redirect('/');
      }
    });
  }
});

//THE SHIPPING WALL
router.use(function(req, res, next){
	if(req.user.defaultShipping){
		return next();
	} else {
		res.redirect('/shipping');
	}
});

//stripe
router.get('/payment', function(req, res, next){
  if(req.user.defaultPayment){
      res.redirect('/');
  } else{
      res.render('payment', {
        key: process.env.STRIPE_PUBLISHABLE_KEY
      });
  }
});

router.post('/payment', function(req, res, next){
  if(req.user.defaultPayment){
      res.redirect('/');
  } else {
      if(req.body.stripeToken && req.body.stripeEmail){

      var stripeToken = req.body.stripeToken;
      stripe.customers.create({
        source: stripeToken,
        description: 'payinguser@example.com'
      }).then(function(customer) {
        console.log("customer object:", customer)
        console.log(customer.sources.data);
        var p = new Payment({
          stripeBrand: customer.sources.data[0].brand,
          stripeCustomerId: customer.id,
          stripeExpMonth: customer.sources.data[0].exp_month,
          stripeExpYear: customer.sources.data[0].exp_year,
          stripeLast4: customer.sources.data[0].last4,
          stripeSource: stripeToken,
          status: 1, //change when multiple cards
          parent: req.user._id
        }).save(function(error, payment){
            if(error){
              return res.status(400).render('error', {
                message: error
              });
            } else {
                User.findByIdAndUpdate(req.user._id, {
                  defaultPayment: payment._id
                }, function(error, user){
                  if(error){
                    return res.status(400).render('error', {
                      message: error
                    });
                  } else {
                      return res.redirect('/');
                  }
                });
            }
        });
      });
    } else {
        return res.redirect('/');
    }
  }
});

//STRIPE WALL
router.use(function(req, res, next){
  if(req.user.defaultPayment){
    return next();
  } else {
    res.redirect('/payment')
  }
});

/* GET home page. */
router.get('/', function(req, res, next) {
  Product.find(function(error, products){
	if(error){
      return res.status(400).render('error', {
        message: error
      });
    }
    var cartItems = 0;
    if(req.session.cart){
      cartItems = req.session.cart.length;
    }
    res.render('products', {
    	products: products,
      quant: cartItems
    })
  });
});

router.get('/product/:pid', function(req, res, next) {
  Product.findById(req.params.pid, function(error, product){
  	if(error){
      return res.status(400).render('error', {
        message: error
      });
    }
    res.render('singleProduct', {
    	product: product
    });
  });
});

router.get('/cart', function(req, res, next){
	var cart = req.session.cart || [];
	req.session.cart = cart;

	res.render('cart', {
		cart: cart,
    notEmpty: req.session.cart.length !== 0
	});
});

router.get('/cart/add/:pid', function(req, res, next) {
  Product.findById(req.params.pid, function(error, product){
  	if(error){
      return res.status(400).render('error', {
        message: error
      });
    }
    req.session.cart.push(product);
    res.redirect('/product/' + req.params.pid)
  });
});

router.get('/cart/delete/:pid', function(req, res, next) {
  // Insert code that takes a product id (pid), finds that product
  // and removes it from the cart array. Remember that you need to use
  // the .equals method to compare Mongoose ObjectIDs.
 
    for(var i = 0; i < req.session.cart.length; i++){
    	if (req.session.cart[i]._id.toString() === req.params.pid){
    		req.session.cart.splice(i, 1);
    		console.log(req.session.cart);
    		res.redirect('/cart');
    		return
    	}
    }
});

router.get('/cart/delete', function(req, res, next) {
  req.session.cart = [];
  res.redirect('/cart');
});

router.post('/cart/checkout', function(req, res, next){
  var o = new Order({
    timestamp: new Date,
    order: [].concat(req.session.cart),
    parent: req.user._id,
    payment: req.user.payment,
    shipping: req.user.shipping,
    status: "shipped"
    //subtotal and total later
  }).save(function(error, order){
    if(error){
      return res.status(400).render('error', {
        message: error
      });
    } else{
      req.session.cart = [];
      return res.redirect('/orderComplete')
    }
  });
});

router.get('/orderComplete', function(req, res, next){
  return res.render('orderComplete');
});
module.exports = router;
