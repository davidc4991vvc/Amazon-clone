var mongoose = require('mongoose');

function randomCode() {
  var min = 1000;
  var max = 9999;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

var userSchema = mongoose.Schema({
	username: String, //THIS IS A PHONE NUMBER
  	password: String,
  	facebookId: String,
    defaultShipping: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Shipping'
    },
    registrationCode: {
        type: String
    },
    defaultPayment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Payment'
    }

});

userSchema.statics.findOrCreate = function(obj, cb) { //statics: fns that are called by class (d/n belong to each object)
    this.findOne({facebookId: obj.facebookId}, function(err, user){
        if(err){
            throw new Error(err);
        } else if(!user){
            var code = randomCode();
            var u = new this({
                username: null,
                password: null,
                facebookId: obj.facebookId,
                registrationCode: code
            }).save(function(error, user){
                if(error){
                    cb(error, null);
                } else {
                    cb(null, user);
                }
            });
        } else {
            cb(null, user);
        }
    }.bind(this));
};

module.exports = mongoose.model('User', userSchema);
