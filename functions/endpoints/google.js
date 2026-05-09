const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");
const geofire = require("geofire-common");
const config = require("../config.json");

const types = [
  "restaurant",
  "bar",
  "cafe",
  "bakery",
  "liquor_store",
  "meal_takeaway",
  "supermarket",
  "meal delivery",
  "park",
  "church",
  "mosque",
  "synagogue",
  "art_gallery",
  "amusement_park",
  "aquarium",
  "bowling_alley",
  "campground",
  "tourist_attraction",
  "travel_agency",
  "zoo",
  "casino",
  "night_club",
  "movie_theater",
  "museum",
  "clothing_store",
  "convenience_store",
  "department_store",
  "shopping_mall",
  "bicycle_store",
  "car_rental",
  "book_store",
  "light_rail_station",
];

const loadPlaces = functions.https.onCall(async (data, context) => {
  let gdata = [];
  const db = admin.firestore();
  const batch = db.batch();
  const googlePlacesRef = db.collection("google").doc("cl").collection("list");
  try {
    let types_recommendations = ["restaurant", "bar", "park"];
    for (let i = 0; i < types_recommendations.length; i++) {
      console.log("Processing type: ", types_recommendations[i]);
      let url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${
        data.location.latitude
      },${data.location.longitude}&radius=${1000}&type=${
        types_recommendations[i]
      }&key=${config.GOOGLE_CREDENTIALS}`;

      let page = await axios.get(url);
      if (page.data.error_message) {
        console.log(page.data);
      }
      page = page.data;
      gdata = gdata.concat(page.results);
    }

    for (let i = 0; i < gdata.length; i++) {
      batch.set(
        googlePlacesRef.doc(gdata[i].place_id),
        {
          geohash: geofire.geohashForLocation([
            gdata[i].geometry.location.lat,
            gdata[i].geometry.location.lng,
          ]),
          location: {
            latitude: gdata[i].geometry.location.lat,
            longitude: gdata[i].geometry.location.lng,
          },
          name: gdata[i].name || "",
          place_id: gdata[i].place_id,
          rating: gdata[i].rating || 0,
          categories: gdata[i].types || [],
          address: gdata[i].vicinity || "",
          photoReference:
            (gdata[i].photos && gdata[i].photos[0].photo_reference) || "",
        },
        { merge: true }
      );
    }

    await batch.commit();
  } catch (e) {
    console.log(e);
  }

  return gdata;
});

module.exports = {
  loadPlaces: loadPlaces,
};
