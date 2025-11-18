const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const OrderSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  userEmail: String,
  title: String,
  description: String,
  status: { type: String, default: 'not viewed' },
  price: Number,
  comments: String,
  createdAt: Date
});
module.exports = mongoose.model('Order', OrderSchema);
