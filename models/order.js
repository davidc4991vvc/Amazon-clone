var mongoose = require('mongoose');

var orderSchema = mongoose.Schema({
	timestamp: Date,
	order: Array,
	parent: mongoose.Schema.Types.ObjectId,
	payment: mongoose.Schema.Types.ObjectId,
	shipping: mongoose.Schema.Types.ObjectId,
	status: String,
	subtotal: Number,
	total: Number
});

module.exports = mongoose.model('Order', orderSchema);