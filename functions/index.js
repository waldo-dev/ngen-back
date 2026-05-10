const admin = require("firebase-admin");
const {
  addUser,
  updateUser,
  listUsers,
  getUser,
  countUser,
} = require("./endpoints/users");
const { fixTours } = require("./endpoints/tours");
const { loadPlaces } = require("./endpoints/google");
const {
  activatePayment,
  createWebpayPayment,
  validateWebpayPayment,
} = require("./endpoints/payments");

admin.initializeApp();

exports.addUser = addUser;
exports.updateUser = updateUser;
exports.listUsers = listUsers;
exports.getUser = getUser;
exports.countUser = countUser;
exports.fixTours = fixTours;
exports.activatePayment = activatePayment;
exports.createWebpayPayment = createWebpayPayment;
exports.validateWebpayPayment = validateWebpayPayment;
exports.loadPlaces = loadPlaces;
