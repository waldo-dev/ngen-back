const functions = require("firebase-functions");
const admin = require("firebase-admin");
const ENV = "dev";
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

// admin.initializeApp(functions.config()[ENV]["firebaseConfig"]);
admin.initializeApp({
  apiKey: "AIzaSyCJDEZoN3zlqJ0_JdrgS3-fLnBEwb7KBV4",
  authDomain: "ngenapp.firebaseapp.com",
  databaseURL: "https://ngenapp.firebaseio.com",
  projectId: "ngenapp",
  storageBucket: "ngenapp.appspot.com",
  messagingSenderId: "701467368687",
  appId: "1:701467368687:web:c851607a4a4e6f72a9cf1a",
  measurementId: "G-PCBMDNFV7T",
});

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
