const functions = require('firebase-functions')
const admin = require('firebase-admin')

const LANG_NAMES = {
    arb: "Arabic",
    cmn: "Mandarin",
    cy: "Cyprus",
    da: "Danish",
    de: "German",
    en: "English",
    es: "Spanish",
    fr: "French",
    is: "Icelandic",
    it: "Italian",
    ja: "Japanese",
    ko: "Korean",
    nb: "Norwegian",
    nl: "Dutch",
    pl: "Polish",
    pt: "Portuguese",
    ro: "Romanian",
    ru: "Russian",
    sv: "Swedish",
    tr: "Turkish",
}

const fixTours = functions.https.onCall(async (data, context) => {
   const firestore = admin.firestore();
   const toursRef = firestore.collection('tours').doc('cl').collection('list');
   const snapshot = await toursRef.get()
   for (let doc of snapshot.docs) {
       const id = doc.id;
       const stepRef = firestore.collection('steps').doc(id).collection('list');
       const stepsSnapshot = await stepRef.get();
       const step = stepsSnapshot.docs[0].data();
       let options = {languages: []}
       for (let lang of Object.keys(step.audio)) {
            options.languages.push({code: lang, name: LANG_NAMES[lang]})
       }
       const tourRef = firestore.collection('tours').doc('cl').collection('list').doc(id);
       await tourRef.update(options)

   }
   return "ok"


});

module.exports = {
    fixTours: fixTours,
}