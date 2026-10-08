// netlify/functions/lib/recollida-especial.js
//
// Llista de comandes amb un lloc de recollida "especial" que s'aplica NOMÉS
// a la sortida de l'exportació (export-data.js). Les comandes guardades als
// blobs no es modifiquen mai: aquí només hi ha order_id -> lloc.
//
// Per afegir-ne o treure'n, edita la llista de sota i torna a desplegar.
// Només s'aplica a comandes en estat "pagat".

const LLOC_ESPECIAL = "Club Bàsquet Sant Just";
const LLOC_912 = "Recollida 912 Runners";

// Grup "912 Runners": qualsevol comanda el club de la qual contingui 912 com a
// número sencer ("912 Runners", "912runners", "912RUNNERS"...). Es mira el
// camp "club_nom" de la comanda en el moment de fer servir la regla, de manera
// que també s'hi afegeixen les inscripcions noves, sense llista de comandes.
const RE_912 = /(^|[^0-9])912([^0-9]|$)/;
function es912(ordre) {
  const p = (ordre && ordre.payload) || {};
  return RE_912.test(String(p.club_nom || p.club || (ordre && (ordre.club_nom || ordre.club)) || ""));
}

// Grup "Club Bàsquet Sant Just": a més de la llista d'ordres de sota, qualsevol
// comanda el club de la qual sigui el Bàsquet Sant Just ("CB Sant Just",
// "C.B. Sant Just", "Club Bàsquet Sant Just", "Club Basket Sant Just"...)
// s'assigna a la taula del club. No inclou altres clubs de Sant Just
// (p. ex. "Atletisme Sant Just").
const RE_CB_SANT_JUST = /(^| )(cb|c b|club (de )?(basquet|basket)|basquet|basket)( club)? sant just( |$)/;
function netClub(s) {
  return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function esClubSantJust(ordre) {
  const p = (ordre && ordre.payload) || {};
  return RE_CB_SANT_JUST.test(netClub(p.club_nom || p.club || (ordre && (ordre.club_nom || ordre.club)) || ""));
}

// order_id de la llista de l'organització (90 comandes pagades).
// "similitud" = el nom no coincidia exactament i es va proposar per semblança.
const ORDRES = [
  ["b76f66e9-d817-4099-9584-eadbcf244afd", "exacte"],
  ["1a9c5cdf-771c-4b33-b8f4-a7ae2bdbde72", "exacte"],
  ["0384df89-b18f-40a8-8d98-20d861546fd1", "exacte"],
  ["4526660a-32c1-41d5-8a37-46d5be04d087", "exacte"],
  ["2fb80afc-1ee8-45dd-9ecb-7a490fc61699", "exacte"],
  ["91069804-ef15-4ba1-b395-794c33942031", "exacte"],
  ["70bc7437-2ac0-4db8-94b9-1dd9580308a5", "exacte"],
  ["42baf3a3-e20a-475e-8f33-86ae835fd4ea", "exacte"],
  ["b90d4f74-ceaa-47e8-856c-42e0c3b84aff", "exacte"],
  ["6a4415ef-9487-4ecb-88c5-f06b0e029d58", "exacte"],
  ["91958a68-360d-4a3d-966b-166ba151b6e2", "exacte"],
  ["ccb29b1b-8859-44ed-a275-61d4dd52d7ba", "exacte"],
  ["f310358c-c731-4bf4-bc34-970045798b1f", "exacte"],
  ["45e19823-8c1c-47ce-8821-89a766ba070a", "exacte"],
  ["7c6d608a-5003-4fb4-a369-9b0ba0788b2a", "exacte"],
  ["8080710e-1fd1-45d8-8022-630ad7d75183", "exacte"],
  ["1156b68c-9cd7-4e62-a728-958a56fe25f1", "exacte"],
  ["7fa74da7-40ad-41e6-a63f-066e99b0655d", "exacte"],
  ["67ce76ab-c47b-40e7-82ba-b3242456950e", "exacte"],
  ["50e437ca-77d2-4942-a152-9896caf812c7", "exacte"],
  ["76e22465-efd2-42b6-b4a2-e8e003eeeb9d", "exacte"],
  ["e78ad6d5-0793-49d8-87b5-7b4c463d3cca", "exacte"],
  ["ee6700be-30ab-4d8d-9297-8e8e34702bf7", "exacte"],
  ["e85be302-587a-448b-a5cb-fdf86d44fa2d", "exacte"],
  ["d785a16a-c856-4c34-8522-b89b628bcccd", "exacte"],
  ["3046c81b-1746-410a-85fa-5f482bdee2ea", "exacte"],
  ["b8d6e536-de1a-4b4d-818d-50a3dd9eff4a", "exacte"],
  ["318b4075-547c-4a4b-8eec-7b018c3503c9", "exacte"],
  ["74c2c200-725b-450a-946b-298cafd83d93", "exacte"],
  ["90d0d0fd-29a4-47cc-8019-ae29d179f8f3", "exacte"],
  ["d7dcd5b7-352f-4431-83e1-67775aa1c2ea", "exacte"],
  ["aa1d2056-e2e4-4527-afe4-c27892058e00", "exacte"],
  ["30adcb1e-3e1e-4ccb-bab2-70e3ca9968e3", "exacte"],
  ["65e9906c-73dd-446f-b8b7-c5d06c469321", "exacte"],
  ["7a5e7fa2-54f4-4dba-a531-721e671ff54e", "exacte"],
  ["f041f17b-5184-45af-8ab1-2a9e669315cb", "exacte"],
  ["0ab88f84-38e7-4ead-9a9d-dbf6e6cf82b0", "exacte"],
  ["845f3a2a-c1fe-4ae6-85f2-33982317e6d4", "exacte"],
  ["8928a658-4d0e-41a2-95fd-441b48ee2244", "exacte"],
  ["6e21fe0b-2bcf-45f7-adc4-80d7b465a192", "exacte"],
  ["5ba7fb6b-bc0d-447c-91a1-170f5432b04d", "exacte"],
  ["b56bdabb-1b77-478f-b9c2-fa462db29c44", "exacte"],
  ["9dbaac8a-ba26-4c31-b5a0-c1e67baa9e3f", "exacte"],
  ["1e8536a6-8ec5-434e-a1cb-61f3fe809dcb", "exacte"],
  ["83213877-3038-4768-b178-8e5ca913e3a5", "exacte"],
  ["5d8b768a-3c0b-4145-892f-b3bf59ac2e2d", "exacte"],
  ["67551724-2250-419a-b270-ccde5646e5bd", "exacte"],
  ["b54053f3-37e0-47d3-a173-c348e11288a3", "exacte"],
  ["6019df10-cab5-4c4b-915e-ee8bc225677b", "exacte"],
  ["076be298-f84f-49c1-9db6-bd6ace8a269d", "exacte"],
  ["214f43b7-deb6-463f-ba4b-4864d039bed1", "exacte"],
  ["1de064de-6241-4045-b3fe-8cb7ed5e8fae", "exacte"],
  ["b679ccde-fc7f-4e4f-aa39-70e5de2ca65a", "exacte"],
  ["d98b977b-c9c8-4c62-be16-acf13f8a176a", "exacte"],
  ["b6ed26c4-2053-4b7f-89cf-469a468335d5", "exacte"],
  ["faa4672f-291f-4f34-8958-ea884fa211e5", "exacte"],
  ["785691d9-2234-4b7b-ad41-727359db6eb8", "exacte"],
  ["07a69a5b-063c-4a2e-b536-8e62136c85aa", "exacte"],
  ["f05f8be8-0d24-494c-b210-129737032b14", "exacte"],
  ["c7b07204-35d7-4638-a84b-c7b5d24cb1b3", "exacte"],
  ["36960914-3b45-4fee-9700-19d2c600fddb", "exacte"],
  ["463ef898-844a-4db5-b71d-60ba896b35fb", "exacte"],
  ["9f2d526b-4193-4dc3-a74a-0aa8f931d6ea", "exacte"],
  ["e225eca8-5a0b-49ee-a112-4adb58d54588", "exacte"],
  ["a214e294-70be-4eb3-b65a-ccd91c9cd3ed", "exacte"],
  ["a731fba6-2366-4fb9-8f06-9f9f535f2d72", "exacte"],
  ["874b7cbd-72b2-43da-a5dc-a1eefcff5fcc", "exacte"],
  ["1296bc00-cfb0-44fb-89e8-617440017137", "exacte"],
  ["ae6d56cd-ebe2-488c-b408-24e488a4b29b", "exacte"],
  ["ee286794-1081-4e7f-917c-515dad779034", "exacte"],
  ["0f9fe799-ff64-4a02-96c5-312b51cb40c7", "exacte"],
  ["5adc25ed-23fa-4892-8e3e-cde1cd4337c9", "exacte"],
  ["5901301d-e8f1-4628-adde-a9c6b304b0ec", "exacte"],
  ["c9b682d0-3e2b-40d3-abb3-75779c476d7d", "exacte"],
  ["3f61b972-9dd6-4857-acb1-07a3a55de15d", "exacte"],
  ["2dae244c-f68a-4e2f-be21-da5918905bce", "exacte"],
  ["3e4b8fc6-e034-4e10-8203-8361a9d3b88c", "exacte"],
  ["ae8b624d-04ed-4b41-b215-d768fe29612e", "similitud"],
  ["d22d3725-ebb8-4863-bafe-94daa9ae5139", "similitud"],
  ["ea7c64e4-dc44-45f1-8e9b-164205fe5dbf", "similitud"],
  ["474e1f3a-2df6-4e60-88d5-b7191ff20955", "similitud"],
  ["d699c990-6651-4279-b5bb-a4c4a8e8a3ec", "similitud"],
  ["14405acf-8227-46b9-8bf4-c409850085f1", "similitud"],
  ["1aa032c4-0f09-458b-ba33-bb08f0e21ea5", "similitud"],
  ["589c5bda-e514-4890-b2f9-924a4394a5b1", "similitud"],
  ["58a09917-2016-4e46-bc89-371deb563bee", "similitud"],
  ["22f3e671-7a18-4524-9d16-3882fd6d078d", "similitud"],
  ["d953cefb-6aca-4edc-a111-43ccda417645", "similitud"],
  ["9ba8c0c1-ac1c-48e6-ab77-ab264b0efc0b", "similitud"],
  ["e6b23915-2bbc-46d2-818f-258eee340ed0", "similitud"],
];

const MAPA = new Map(ORDRES.map(([id]) => [id, LLOC_ESPECIAL]));

// És del grup Club Bàsquet Sant Just? (llista de l'organització o club pel nom)
function esSantJust(ordre) {
  return !!ordre && (MAPA.has(ordre.order_id) || esClubSantJust(ordre));
}

// Retorna el lloc de recollida a exportar per a una comanda. "puntTriatNom" és
// el nom del punt que el participant ha triat des del perfil (només es té en
// compte al grup 912, que pot canviar de punt).
function recollidaPerExportar(ordre, puntTriatNom) {
  const original = ordre && ordre.recollida_text;
  if (!ordre || String(ordre.estat || "").trim().toLowerCase() !== "pagat") return original;
  return (esSantJust(ordre) ? LLOC_ESPECIAL : null) || (es912(ordre) ? (puntTriatNom || LLOC_912) : original);
}

module.exports = { recollidaPerExportar, LLOC_ESPECIAL, LLOC_912, ORDRES, es912, esSantJust, esClubSantJust };
