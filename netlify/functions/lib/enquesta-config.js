// netlify/functions/lib/enquesta-config.js
//
// Enllaços i fotos del correu resum (agraïment + enquesta + vídeo + incidències).
// Tot el que cal tocar per personalitzar el correu és aquí.

module.exports = {
  // Carpeta de Drive per VEURE les fotos. IMPORTANT: ha d'estar compartida com a
  // "Qualsevol persona amb l'enllaç: LECTOR" (Visualitzador), no com a Editor, perquè
  // l'enllaç del correu no deixi que ningú esborri fotos. (Variable d'entorn
  // ENQUESTA_DRIVE_FOTOS per canviar-la sense tocar el codi.)
  fotosUrl: process.env.ENQUESTA_DRIVE_FOTOS || "https://drive.google.com/drive/folders/1yOk0IVwt4SapRCHliQi8GnbjWAlNvUgX?usp=sharing",

  // Enllaç per PUJAR fotos: la pàgina llobregat.org/fotos (envia les fotos al script de Google,
  // que les desa a Drive sense que ningú pugui esborrar res). Buit = un sol botó "Veure i pujar".
  // (Variable d'entorn ENQUESTA_FORM_FOTOS per canviar-lo.)
  fotosPujarUrl: process.env.ENQUESTA_FORM_FOTOS || ((process.env.SITE_URL || "https://llobregat.org").replace(/\/$/, "") + "/fotos"),

  // Carpeta de Drive on pugen el testimoni en vídeo.
  videosUrl: process.env.ENQUESTA_DRIVE_VIDEOS || "https://drive.google.com/drive/folders/10lcXjmXpFSTnOKl74w1dpIjnhm6SD9uO?usp=sharing",

  // Fotos que surten dalt del correu (adreces ABSOLUTES d'imatges publicades al web).
  // Es mostren 1, 2 o 3. Buit = el correu surt sense fotos.
  fotos: [
    "https://llobregat.org/img/correu/foto1.jpg",
    "https://llobregat.org/img/correu/foto2.jpg",
    "https://llobregat.org/img/correu/foto3.jpg",
  ],
};
