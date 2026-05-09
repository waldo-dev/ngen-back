const functions = require("firebase-functions");
const admin = require("firebase-admin");
const paypal = require("paypal-rest-sdk");
const payments = paypal.v1.payments;
const config = require("../config.json");
const env = new paypal.core.SandboxEnvironment(
  config.PAYPAL_CLIENT_ID,
  config.PAYPAL_CLIENT_SECRET
);
const paypalClient = new paypal.core.PayPalHttpClient(env);

const WebpayPlus = require("transbank-sdk").WebpayPlus;
const Environment = require("transbank-sdk").Environment;

let webpayEnv = "prod";
WebpayPlus.commerceCode =
  webpayEnv === "prod" ? "597042178871" : "597055555532";
WebpayPlus.apiKey =
  webpayEnv === "prod"
    ? "d491eeb763de04fa9908071829808ad5"
    : "579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C";
WebpayPlus.environment =
  webpayEnv === "prod" ? Environment.Production : Environment.Integration;

exports.activatePayment = functions.https.onCall(async (data, context) => {
  const user = context.auth;
  if (!user)
    return {
      error:
        "Request not authorized. User must be a logged in to fulfill request.",
    };

  if (!data.paymentId && !data.exchange)
    throw Error("Missing payment identifier");

  let paymentId = data.paymentId;
  let request = new payments.PaymentGetRequest(paymentId);
  let resp = await paypalClient.execute(request);
  let payment = resp.result;

  return processSubscriptionPaypal(data, payment, paymentId, user);
});

async function processSubscriptionPaypal(data, payment, paymentId, user) {
  if (!data.quantity) {
    throw Error("Missing months of subscription");
  }

  let subscriptionUSDPrice = 10;

  if (payment.state == "approved" || payment.state == "created") {
    if (!payment.transactions.length) {
      qr.paymentState = "failed";
      throw Error("There is no transaction");
    }
    let transaction = payment.transactions[0];
    if (data.quantity != +transaction.amount.total / subscriptionUSDPrice) {
      throw Error("The number of months is not equal to the quantity payed");
    }
  }
  let transaction = payment.transactions[0];

  return await createSubscription(
    user.uid,
    data.quantity,
    paymentId,
    "paypal",
    transaction.amount.total
  );
}

async function createSubscription(uid, quantity, paymentId, method, amount) {
  let snapshot = await admin
    .firestore()
    .collection("subscriptions")
    .doc(uid)
    .get();
  let oldSubscription = snapshot.data();
  let todayString = new Date().toISOString().slice(0, 10);
  let expires_at = new Date(
    new Date().setMonth(new Date().getMonth() + quantity)
  )
    .toISOString()
    .slice(0, 10);
  let starts_at = oldSubscription
    ? oldSubscription.starts_at
    : new Date().toISOString().slice(0, 10);
  if (oldSubscription && oldSubscription.expires_at > todayString) {
    expires_at = new Date(
      new Date(oldSubscription.expires_at).setMonth(
        new Date(oldSubscription.expires_at).getMonth() + quantity
      )
    )
      .toISOString()
      .slice(0, 10);
  }

  let subscription = {
    expires_at: expires_at,
    payment_method: method,
    transaction_id: paymentId,
    starts_at: starts_at,
    updated_at: new Date().toISOString().slice(0, 10),
  };

  let transaction = {
    amount: amount,
    userId: uid,
    paymentState: "accepted",
    date:
      new Date().toISOString().substring(0, 10) +
      " " +
      new Date().toTimeString().substring(0, 8),
  };

  await admin
    .firestore()
    .collection(method)
    .doc(paymentId)
    .set(transaction, { merge: true });
  await admin
    .firestore()
    .collection("subscriptions")
    .doc(uid)
    .set(subscription, { merge: true });
  return { subscription: subscription };
}

exports.createWebpayPayment = functions.https.onRequest((req, res) => {
  let sesId = req.query.uid;
  let amount = req.query.amount;
  let host = req.query.hs;
  let url = "https://" + req.get("host");

  WebpayPlus.Transaction.create(
    Date.now() + "",
    sesId + "",
    +amount,
    url + "/validateWebpayPayment"
    //finalURL: url + '/redirectWebPayPayment',
  )
    .then((data) => {
      let tr = {
        amount: amount,
        userId: sesId,
        host: host,
        paymentState: "created",
        date:
          new Date().toISOString().substring(0, 10) +
          " " +
          new Date().toTimeString().substring(0, 8),
      };

      admin
        .firestore()
        .collection("webpay")
        .doc(data.token)
        .set(tr, { merge: true });
      res.redirect(data.url + "?token_ws=" + data.token);
    })
    .catch((err) => {
      console.error(err);
    });
});

exports.validateWebpayPayment = functions.https.onRequest((req, res) => {
  let token = req.body.token_ws;
  let tbkToken = req.body.TBK_TOKEN;
  let subcriptionPriceCLP = 10000;
  let tr;

  console.log("pre token", token);
  console.log("pre TBK token", tbkToken);

  if (tbkToken) {
    admin.firestore().collection("webpay").doc(tbkToken).update({
      paymentState: "rejected",
    });

    admin
      .firestore()
      .collection("webpay")
      .doc(tbkToken)
      .get()
      .then((trv) => {
        tr = trv.data();
        res.redirect(`https://${tr.host}/voucher/${tbkToken}`);
      })
      .catch((err) => {
        console.error(err);
      });
  } else {
    WebpayPlus.Transaction.commit(token)
      .then((response) => {
        console.log("pos acknowledgeTransaction", response);
        console.log(response.response_code);
        if (response.response_code < 0) {
          admin.firestore().collection("webpay").doc(token).update({
            paymentState: "rejected",
          });
        } else {
          admin.firestore().collection("webpay").doc(token).update({
            paymentState: "accepted",
          });
          success = true;
        }
        return admin.firestore().collection("webpay").doc(token).get();
      })
      .then((trv) => {
        tr = trv.data();
        let quantity = ~~(tr.amount / subcriptionPriceCLP);
        if (quantity > 0) {
          return createSubscription(
            tr.userId,
            quantity,
            token,
            "webpay",
            subcriptionPriceCLP
          );
        } else {
          console.log("Error al comprar suscripción");
          return false;
        }
      })
      .then((r) => {
        res.redirect(`https://${tr.host}/voucher/${token}`);
      })
      .catch((err) => {
        console.error(err);
      });
  }
});
