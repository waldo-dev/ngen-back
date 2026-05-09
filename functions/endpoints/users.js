const express = require("express");
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { authenticated, handleResponse } = require("../utils");

const addUser = functions.https.onCall(async (data, context) => {
  const email = data.email;
  if (!email) {
    return handleResponse("failed-precondition", "email");
  }
  const password = data.password;
  if (!password) {
    return handleResponse("failed-precondition", "password");
  }

  try {
    const user = await admin.auth().createUser({
      email: email,
      emailVerified: true,
      password: password,
      displayName: data.displayName,
      phoneNumber: data.phone,
      disabled: false,
    });
    if (!user) {
      return handleResponse("data-loss", "User could not be created");
    }

    const role = data.role;

    // Webapp user
    if (
      (role && authenticated(context, "admin")) ||
      (role === "user" && !authenticated(context, "admin"))
    ) {
      if (data.password !== data.repeatedPassword) {
        await admin.auth().deleteUser(user.uid);
        return handleResponse("failed-precondition", "identical passwords");
      }
      await admin.auth().setCustomUserClaims(user.uid, {
        role: role,
      });
    } else if (role && !authenticated(context, "admin")) {
      await admin.auth().deleteUser(user.uid);
      await admin
        .firestore()
        .collection("analytics")
        .doc("app")
        .set(
          {
            totalUsers: admin.firestore.FieldValue.increment(-1),
            updatedAt: new Date().toISOString().replace("T", " ").split(".")[0],
          },
          { merge: true }
        );
      handleResponse(
        "unauthenticated",
        "The function must be called while authenticated."
      );
    }
    let response = Object.assign({}, user);
    ["passwordHash", "passwordSalt", "providerData"].forEach(
      (key) => delete response[key]
    );
    return response;
  } catch (error) {
    handleResponse("data-loss", error.message);
  }
});

const updateUser = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    return handleResponse(
      "unauthenticated",
      "The function must be called while authenticated."
    );
  }

  if (data.uid !== context.auth.uid && !authenticated(context, "admin")) {
    return handleResponse("failed-precondition", "admin role.");
  }
  const user = await admin.auth().updateUser(data.uid, data);

  let claims = {};
  if (data.role) {
    claims.role = data.role;
  }
  let response = Object.assign({}, user);
  if (authenticated(context, "admin")) {
    await admin.auth().setCustomUserClaims(data.uid, claims);
    response.customClaims = claims;
  }

  ["passwordHash", "passwordSalt", "providerData"].forEach(
    (key) => delete response[key]
  );
  return response;
});

const listUsers = functions.https.onCall(async (data, context) => {
  if (!context.auth && !authenticated(context, "admin")) {
    return handleResponse(
      "unauthenticated",
      "The function must be called while authenticated with admin privileges."
    );
  }

  if (!data["$limit"] || data["$limit"] > 50) {
    data["$limit"] = 50;
  }
  if (!data["$skip"]) {
    data["$skip"] = 0;
  }

  let totalUsersRef = admin.firestore().collection("analytics").doc("app");
  let analytics = await totalUsersRef.get();
  let totalUsers = analytics.data().totalUsers;
  let skip = 0;
  let total = 0;

  /* Users pagination */
  const limitUsers = async (nextPageToken) => {
    return admin
      .auth()
      .listUsers(data["$limit"], nextPageToken)
      .then(async (listUsersResult) => {
        let users = [];
        if (skip + listUsersResult.users.length > data["$skip"]) {
          listUsersResult.users.forEach((userRecord) => {
            if (total >= data["$limit"]) {
              return users;
            }
            /* Filter users by role */
            if (skip >= data["$skip"]) {
              let record = Object.assign({}, userRecord);
              total++;
              ["passwordHash", "passwordSalt", "providerData"].forEach(
                (key) => delete record[key]
              );
              users.push(record);
            } else {
              skip++;
            }
          });
        } else {
          skip += listUsersResult.users.length;
        }
        if (listUsersResult.pageToken && total < data["$limit"]) {
          // List next batch of users.
          users = users.concat(
            (await limitUsers(listUsersResult.pageToken)).users
          );
        }
        return {
          users: users,
          total: totalUsers,
          $skip: data["$skip"],
          $limit: data["$limit"],
        };
      })
      .catch((error) => {
        handleResponse("data-loss", error.message);
      });
  };
  return limitUsers();
});

const getUser = functions.https.onCall(async (data, context) => {
  if (!context.auth && !authenticated(context, "admin")) {
    return handleResponse(
      "unauthenticated",
      "The function must be called while authenticated with admin privileges."
    );
  }
  const user = admin.auth().getUser(data.uid);
  let response = Object.assign({}, user);
  ["passwordHash", "passwordSalt", "providerData"].forEach(
    (key) => delete response[key]
  );
  return response;
});

const countUser = functions.auth.user().onCreate((user) => {
  let docPath = user.customClaims.role ? "web" : "app";
  return admin
    .firestore()
    .collection("analytics")
    .doc(docPath)
    .set(
      {
        totalUsers: admin.firestore.FieldValue.increment(1),
        updatedAt: new Date().toISOString().replace("T", " ").split(".")[0],
      },
      { merge: true }
    );
});

module.exports = {
  addUser: addUser,
  updateUser: updateUser,
  listUsers: listUsers,
  getUser: getUser,
  countUser: countUser,
};
