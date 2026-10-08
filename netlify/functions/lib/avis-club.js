// lib/avis-club.js
//
// Aclariment puntual per a 17 persones que, per un error nostre, poden haver
// rebut un correu dient que el seu punt de recollida era el Club Bàsquet Sant
// Just. El club no les gestiona: el seu punt és el que van triar a la
// inscripció. Es reenvia el correu del QR amb el punt correcte i una nota.
// Un cop enviat a una persona, queda anotat i no es torna a enviar.

const PERSONES = [
  ["0acb35af-df61-4427-b7fd-714448429b3a", "Victoria Miranda Peña"],
  ["18455dd1-9dfe-434b-8f61-a24392a53df4", "Bernat Duran Cendrós"],
  ["1ed4cb4a-5f6c-4c3d-a3b9-d6006717128b", "Joana Llopis"],
  ["2153d1e2-e132-4938-9de0-7f1cf2cad3d1", "Sonia Sanchez Suriol"],
  ["2779fdd4-28cc-437c-b0c7-68699bb6bb81", "Eloi Satorre Llopis"],
  ["40b18eed-86d6-4667-9b9b-d207d5991625", "Xavier Duran Badia"],
  ["4850204d-50f4-4c4a-b575-d75e66dc80de", "Amanda Bernabe Miranda"],
  ["71d91daa-eb77-4a52-a5f1-cb4cb03a7a81", "Marcel Fernández de la Fuente Larrosa"],
  ["81102ffe-e5c9-44d3-aa1c-2cd22c683966", "Roger Satorre Bern"],
  ["8c0011ff-2e2a-42ba-ab16-dd7d16ecba1e", "Guillem Águeda sole"],
  ["8e00f557-513d-4d6a-9d9c-0dbfcc8d1b44", "Joan Martínez Martínez"],
  ["95a42b45-66c5-470c-b13e-69285cdd0a7b", "Silvia Fernández Paredes"],
  ["a14dd92e-c96c-49fe-91c4-5a2a2f3bc13a", "Joan Tost"],
  ["b50c1f5b-81b5-4d01-b0fd-0c13b71ed4a9", "Laia Cendrós"],
  ["ca7f92c1-4ee3-44cd-b0f4-d79b365a351c", "Xènia Tarifa Fernandez"],
  ["dfb8e7a1-9883-43e1-8379-47054c76e028", "Patricia De los Angeles Ferré"],
  ["e51fc02a-0381-4979-8a12-20bcf54601b0", "Damián López Belmonte"],
];

const CLAU = "club-17";

const EXTRA = {
  assumpte: {
    CA: "Aclariment sobre el teu punt de recollida — Llobregat x la Diabetis",
    ES: "Aclaración sobre tu punto de recogida — Llobregat x la Diabetis",
    EN: "Clarification about your pickup point — Llobregat x la Diabetis",
  },
  intro: {
    CA: "Et tornem a enviar el teu QR personal amb el punt de recollida correcte.",
    ES: "Te volvemos a enviar tu QR personal con el punto de recogida correcto.",
    EN: "Here is your personal QR again, with the correct pickup point.",
  },
  avis: {
    CA: "Aclariment important: si abans has rebut un correu nostre amb el QR que deia que el teu punt de recollida era «Club Bàsquet Sant Just», era un error nostre. El teu punt és el de la teva inscripció, el que veus a sota. El QR és el mateix i continua sent vàlid. Disculpa les molèsties.",
    ES: "Aclaración importante: si antes recibiste un correo nuestro con el QR que decía que tu punto de recogida era «Club Bàsquet Sant Just», era un error nuestro. Tu punto es el de tu inscripción, el que ves abajo. El QR es el mismo y sigue siendo válido. Disculpa las molestias.",
    EN: "Important clarification: if you previously received an email from us with your QR saying your pickup point was «Club Bàsquet Sant Just», that was our mistake. Your point is the one from your registration, shown below. The QR is the same and is still valid. Sorry for the inconvenience.",
  },
};

module.exports = { PERSONES, CLAU, EXTRA };
