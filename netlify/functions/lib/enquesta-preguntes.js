// netlify/functions/lib/enquesta-preguntes.js
//
// DEFINICIÓ ÚNICA de l'enquesta de valoració del repte: grups, seccions i
// preguntes en català, castellà i anglès. La fan servir:
//   - enquesta.js         -> serveix la definició a la pàgina i valida les respostes
//   - admin-enquestes.js  -> etiquetes del resum i del CSV
// Per afegir, treure o canviar una pregunta, només cal tocar aquest fitxer.
//
// Tipus de pregunta:
//   estrelles : valoració 1-5 (opcional na:true -> botó "No aplica")
//   nps       : escala 0-10 ("recomanaries...")
//   unica     : una sola opció      (opcions: [{v, ca, es, en}])
//   multi     : diverses opcions    (opcions)  — altre:true afegeix "Altres: ..."
//   text      : resposta oberta (màx. 2000 caràcters)
// req:true  -> obligatòria. Cada pregunta és opcional per defecte.

const T = (ca, es, en) => ({ ca, es, en });
const O = (v, ca, es, en) => ({ v, ca, es, en });

const SI_POTSER_NO = [
  O("si", "Sí", "Sí", "Yes"),
  O("potser", "Potser / ho he de pensar", "Quizás / lo tengo que pensar", "Maybe / need to think about it"),
  O("no", "No", "No", "No"),
];

const GRUPS = {
  participant: {
    nom: T("Participant", "Participante", "Participant"),
    desc: T("Has caminat, corregut, pedalat, animat o donat", "Has caminado, corrido, pedaleado, animado o donado", "You walked, ran, cycled, cheered or donated"),
  },
  ajuntament: {
    nom: T("Ajuntament o amfitrió", "Ayuntamiento o anfitrión", "Town council or host"),
    desc: T("Ajuntament, regidoria o entitat local que ha acollit el repte", "Ayuntamiento, concejalía o entidad local que ha acogido el reto", "Town council, department or local group that hosted the challenge"),
  },
  voluntari: {
    nom: T("Voluntari/ària o organització", "Voluntario/a u organización", "Volunteer or organising team"),
    desc: T("Has ajudat abans, durant o després del repte", "Has ayudado antes, durante o después del reto", "You helped before, during or after the challenge"),
  },
  entitat: {
    nom: T("Entitat, col·laborador o donant", "Entidad, colaborador o donante", "Organisation, sponsor or donor"),
    desc: T("Empresa, entitat, club, mitjà o persona que ha col·laborat o donat", "Empresa, entidad, club, medio o persona que ha colaborado o donado", "Company, organisation, club, media outlet or person who supported us"),
  },
};

// Preguntes de perfil: només es demanen si NO sabem qui és (no ve d'un enllaç
// de correu). Les respostes es guarden a "perfil".
const PERFIL = [
  { id: "nom", tipus: "text", curt: true, text: T("Com et dius? (opcional)", "¿Cómo te llamas? (opcional)", "What is your name? (optional)") },
  { id: "org", tipus: "text", curt: true,
    text: {
      participant: T("Poble, ciutat o club (opcional)", "Pueblo, ciudad o club (opcional)", "Town, city or club (optional)"),
      ajuntament: T("Ajuntament o entitat local", "Ayuntamiento o entidad local", "Town council or local group"),
      voluntari: T("Equip o zona on has ajudat (opcional)", "Equipo o zona donde has ayudado (opcional)", "Team or area where you helped (optional)"),
      entitat: T("Nom de l'entitat, empresa o club (opcional)", "Nombre de la entidad, empresa o club (opcional)", "Name of the organisation, company or club (optional)"),
    } },
  { id: "modalitat", tipus: "unica", grups: ["participant"],
    text: T("Com hi has participat?", "¿Cómo has participado?", "How did you take part?"),
    opcions: [
      O("caminant", "Caminant", "Caminando", "Walking"),
      O("corrent", "Corrent", "Corriendo", "Running"),
      O("bici", "En bici", "En bici", "Cycling"),
      O("animar", "Animant des de casa o al carrer", "Animando desde casa o en la calle", "Cheering from home or on the street"),
      O("dorsal0", "Dorsal 0 / donatiu", "Dorsal 0 / donativo", "Dorsal 0 / donation"),
    ] },
  { id: "tram", tipus: "text", curt: true, grups: ["participant"],
    text: T("Quin tram o pobles has fet? (opcional)", "¿Qué tramo o pueblos has hecho? (opcional)", "Which stretch or towns did you do? (optional)") },
];

// Bloc de tancament comú a tots els grups.
const TANCAMENT = (repetirText, propostesText) => ({
  id: "cloenda",
  titol: T("Per acabar", "Para terminar", "To finish"),
  preguntes: [
    { id: "millor", tipus: "text", text: T("Què ha funcionat millor?", "¿Qué ha funcionado mejor?", "What worked best?") },
    { id: "millorar", tipus: "text", text: T("Què hauríem de millorar?", "¿Qué deberíamos mejorar?", "What should we improve?") },
    { id: "propostes", tipus: "text", text: propostesText || T("Propostes i idees per millorar", "Propuestas e ideas para mejorar", "Proposals and ideas for improvement") },
    { id: "repetiria", tipus: "unica", req: true, text: repetirText, opcions: SI_POTSER_NO },
    { id: "recomanaria", tipus: "nps", text: T("Del 0 al 10, quant recomanaries el repte a algú que no el coneix?", "Del 0 al 10, ¿cuánto recomendarías el reto a alguien que no lo conoce?", "From 0 to 10, how likely are you to recommend the challenge to someone who doesn't know it?") },
    { id: "comentari", tipus: "text", text: T("Algun altre comentari? Tot és benvingut.", "¿Algún otro comentario? Todo es bienvenido.", "Any other comments? Everything is welcome.") },
  ],
});

const SECCIONS = {
  // ---------------------------------------------------------------- PARTICIPANTS
  participant: [
    {
      id: "global",
      titol: T("La teva experiència", "Tu experiencia", "Your experience"),
      preguntes: [
        { id: "global", tipus: "estrelles", req: true, text: T("Valoració global del repte", "Valoración global del reto", "Overall rating of the challenge") },
        { id: "expectatives", tipus: "unica", text: T("Comparat amb el que t'esperaves, el repte ha estat…", "Comparado con lo que esperabas, el reto ha sido…", "Compared to what you expected, the challenge was…"),
          opcions: [
            O("per_sota", "Per sota de les expectatives", "Por debajo de lo esperado", "Below expectations"),
            O("complertes", "Tal com m'esperava", "Tal como esperaba", "As expected"),
            O("superades", "Per sobre de les expectatives", "Por encima de lo esperado", "Above expectations"),
          ] },
        { id: "motiu", tipus: "multi", altre: true, text: T("Què et va motivar a participar-hi?", "¿Qué te motivó a participar?", "What motivated you to take part?"),
          opcions: [
            O("causa", "Donar suport a la recerca de la diabetis tipus 1", "Apoyar la investigación de la diabetes tipo 1", "Supporting type 1 diabetes research"),
            O("personal", "Tinc un vincle personal amb la diabetis", "Tengo un vínculo personal con la diabetes", "I have a personal connection to diabetes"),
            O("esport", "El repte esportiu", "El reto deportivo", "The sporting challenge"),
            O("pobles", "Conèixer els pobles del Llobregat", "Conocer los pueblos del Llobregat", "Discovering the Llobregat towns"),
            O("colla", "Amics, família o la meva colla/club", "Amigos, familia o mi grupo/club", "Friends, family or my group/club"),
          ] },
        { id: "coneixer", tipus: "multi", altre: true, text: T("Com ens vas conèixer?", "¿Cómo nos conociste?", "How did you hear about us?"),
          opcions: [
            O("xarxes", "Xarxes socials", "Redes sociales", "Social media"),
            O("boca", "Amics o família", "Amigos o familia", "Friends or family"),
            O("entitat", "El meu club o entitat", "Mi club o entidad", "My club or organisation"),
            O("ajuntament", "El meu ajuntament", "Mi ayuntamiento", "My town council"),
            O("premsa", "Premsa, ràdio o TV", "Prensa, radio o TV", "Press, radio or TV"),
            O("web", "La web llobregat.org", "La web llobregat.org", "The llobregat.org website"),
          ] },
      ],
    },
    {
      id: "abans",
      titol: T("Abans del repte", "Antes del reto", "Before the challenge"),
      preguntes: [
        { id: "inscripcio", tipus: "estrelles", na: true, text: T("Facilitat del procés d'inscripció i pagament", "Facilidad del proceso de inscripción y pago", "Ease of the registration and payment process") },
        { id: "informacio", tipus: "estrelles", na: true, text: T("Informació rebuda abans (reglament, horaris, punts de pas, recollida de material)", "Información recibida antes (reglamento, horarios, puntos de paso, recogida de material)", "Information received beforehand (rules, schedules, route points, kit collection)") },
        { id: "comunicacio", tipus: "estrelles", na: true, text: T("Comunicació per correu i xarxes", "Comunicación por correo y redes", "Communication by email and social media") },
        { id: "preu", tipus: "unica", text: T("El preu de la inscripció et va semblar…", "El precio de la inscripción te pareció…", "The registration fee seemed…"),
          opcions: [
            O("alt", "Massa alt", "Demasiado alto", "Too high"),
            O("just", "Just", "Justo", "Fair"),
            O("baix", "Baix: n'hauria pagat més", "Bajo: habría pagado más", "Low: I would have paid more"),
          ] },
      ],
    },
    {
      id: "dia",
      titol: T("Durant el repte", "Durante el reto", "During the challenge"),
      preguntes: [
        { id: "traccat", tipus: "estrelles", na: true, text: T("Recorregut i track", "Recorrido y track", "Route and GPX track") },
        { id: "seguretat", tipus: "estrelles", na: true, text: T("Seguretat (talls de trànsit, creuaments, acompanyament)", "Seguridad (cortes de tráfico, cruces, acompañamiento)", "Safety (road closures, crossings, escorts)") },
        { id: "avituallaments", tipus: "estrelles", na: true, text: T("Avituallaments", "Avituallamientos", "Refreshment points") },
        { id: "material", tipus: "estrelles", na: true, text: T("Recollida de material (samarreta, dorsal, bossa)", "Recogida de material (camiseta, dorsal, bolsa)", "Kit collection (T-shirt, bib, bag)") },
        { id: "logistica", tipus: "estrelles", na: true, text: T("Transport i logística (tornar al punt d'inici, equipatges…)", "Transporte y logística (volver al punto de inicio, equipajes…)", "Transport and logistics (getting back to the start, luggage…)") },
        { id: "acollida", tipus: "estrelles", na: true, text: T("Acollida i ambient als pobles", "Acogida y ambiente en los pueblos", "Welcome and atmosphere in the towns") },
        { id: "voluntaris", tipus: "estrelles", na: true, text: T("Atenció dels voluntaris i l'organització", "Atención de los voluntarios y la organización", "Help from volunteers and the organisation") },
        { id: "dificultat", tipus: "unica", text: T("El teu tram, de dificultat, va ser…", "Tu tramo, de dificultad, fue…", "Your stretch was…"),
          opcions: [
            O("facil", "Massa fàcil", "Demasiado fácil", "Too easy"),
            O("adequat", "Adequat", "Adecuado", "Just right"),
            O("dur", "Massa dur", "Demasiado duro", "Too hard"),
          ] },
        { id: "incidencia", tipus: "text", text: T("Has tingut algun problema o incident? Explica'ns què va passar i on.", "¿Has tenido algún problema o incidente? Cuéntanos qué pasó y dónde.", "Did you have any problem or incident? Tell us what happened and where.") },
      ],
    },
    {
      id: "futur",
      titol: T("Si hi hagués una altra edició", "Si hubiera otra edición", "If there were another edition"),
      preguntes: [
        { id: "quan", tipus: "unica", text: T("Si es tornés a fer, quan t'aniria millor?", "Si se volviera a hacer, ¿cuándo te iría mejor?", "If it were held again, when would suit you best?"),
          opcions: [
            O("octubre", "Igual: a l'octubre", "Igual: en octubre", "Same: in October"),
            O("primavera", "A la primavera", "En primavera", "In spring"),
            O("estiu", "A l'estiu", "En verano", "In summer"),
            O("indiferent", "Em és igual", "Me da igual", "I don't mind"),
          ] },
        { id: "afegiria", tipus: "multi", altre: true, text: T("Si hi hagués una altra edició, què t'agradaria que tingués?", "Si hubiera otra edición, ¿qué te gustaría que tuviera?", "If there were another edition, what would you like it to include?"),
          opcions: [
            O("curts", "Més trams curts i accessibles", "Más tramos cortos y accesibles", "More short, accessible stretches"),
            O("familiar", "Una modalitat familiar o infantil", "Una modalidad familiar o infantil", "A family or children's category"),
            O("activitats", "Activitats als pobles (xerrades, música, mercat…)", "Actividades en los pueblos (charlas, música, mercado…)", "Activities in the towns (talks, music, market…)"),
            O("diabetis", "Més informació i sensibilització sobre la diabetis", "Más información y sensibilización sobre la diabetes", "More information and awareness about diabetes"),
            O("seguiment", "Seguiment dels participants al mapa", "Seguimiento de los participantes en el mapa", "Participant tracking on a map"),
            O("dies", "Més dies o un altre recorregut", "Más días u otro recorrido", "More days or a different route"),
          ] },
        { id: "voluntari_futur", tipus: "unica", text: T("Si hi hagués una altra edició, t'agradaria ajudar com a voluntari/ària?", "Si hubiera otra edición, ¿te gustaría ayudar como voluntario/a?", "If there were another edition, would you like to help as a volunteer?"), opcions: SI_POTSER_NO },
      ],
    },
    TANCAMENT(
      T("Si hi hagués una altra edició, tornaries a participar-hi?", "Si hubiera otra edición, ¿volverías a participar?", "If there were another edition, would you take part again?")
    ),
  ],

  // ---------------------------------------------------------------- AJUNTAMENTS
  ajuntament: [
    {
      id: "coordinacio",
      titol: T("La relació amb l'organització", "La relación con la organización", "Working with the organisers"),
      preguntes: [
        { id: "global", tipus: "estrelles", req: true, text: T("Valoració global de l'experiència com a municipi", "Valoración global de la experiencia como municipio", "Overall rating of the experience for your municipality") },
        { id: "coordinacio", tipus: "estrelles", text: T("Coordinació amb l'organització", "Coordinación con la organización", "Coordination with the organisers") },
        { id: "informacio", tipus: "estrelles", text: T("Informació rebuda amb antelació (horaris, necessitats, protocols)", "Información recibida con antelación (horarios, necesidades, protocolos)", "Information received in advance (schedules, needs, protocols)") },
        { id: "resposta", tipus: "estrelles", text: T("Rapidesa i claredat de les respostes de l'organització", "Rapidez y claridad de las respuestas de la organización", "Speed and clarity of the organisers' replies") },
        { id: "carrega", tipus: "unica", text: T("La càrrega de feina per a l'ajuntament ha estat…", "La carga de trabajo para el ayuntamiento ha sido…", "The workload for the town council was…"),
          opcions: [
            O("lleugera", "Lleugera", "Ligera", "Light"),
            O("assumible", "Assumible", "Asumible", "Manageable"),
            O("elevada", "Elevada", "Elevada", "High"),
            O("excessiva", "Excessiva", "Excesiva", "Excessive"),
          ] },
      ],
    },
    {
      id: "dia",
      titol: T("El pas pel municipi", "El paso por el municipio", "The challenge in your municipality"),
      preguntes: [
        { id: "acollida", tipus: "estrelles", text: T("Com va anar el pas, l'acollida o l'aturada al municipi", "Cómo fue el paso, la acogida o la parada en el municipio", "How the stop, welcome or passage through the municipality went") },
        { id: "serveis", tipus: "estrelles", na: true, text: T("Serveis municipals implicats (policia local, protecció civil, brigada…)", "Servicios municipales implicados (policía local, protección civil, brigada…)", "Municipal services involved (local police, civil protection, works crew…)") },
        { id: "avituallament", tipus: "estrelles", na: true, text: T("Avituallament i infraestructures", "Avituallamiento e infraestructuras", "Refreshments and infrastructure") },
        { id: "veinat", tipus: "estrelles", na: true, text: T("Participació i implicació del veïnat", "Participación e implicación del vecindario", "Involvement of local residents") },
        { id: "entitats_locals", tipus: "unica", text: T("Han participat entitats locals?", "¿Han participado entidades locales?", "Did local groups take part?"),
          opcions: [
            O("cap", "Cap", "Ninguna", "None"),
            O("algunes", "Algunes", "Algunas", "Some"),
            O("moltes", "Moltes", "Muchas", "Many"),
          ] },
        { id: "incidencia", tipus: "text", text: T("Incidències, problemes o dificultats que hàgiu tingut", "Incidencias, problemas o dificultades que hayáis tenido", "Incidents, problems or difficulties you encountered") },
      ],
    },
    {
      id: "valor",
      titol: T("Valor per al municipi", "Valor para el municipio", "Value for your municipality"),
      preguntes: [
        { id: "visibilitat", tipus: "estrelles", text: T("Visibilitat i imatge que ha aportat al municipi", "Visibilidad e imagen que ha aportado al municipio", "Visibility and image it brought to the municipality") },
        { id: "sensibilitzacio", tipus: "estrelles", text: T("Sensibilització sobre la diabetis entre la ciutadania", "Sensibilización sobre la diabetes entre la ciudadanía", "Diabetes awareness among residents") },
        { id: "rol_futur", tipus: "multi", altre: true, text: T("Si hi hagués una altra edició, com us agradaria participar-hi?", "Si hubiera otra edición, ¿cómo os gustaría participar?", "If there were another edition, how would you like to take part?"),
          opcions: [
            O("pas", "Tornar a ser punt de pas", "Volver a ser punto de paso", "Be a route point again"),
            O("inici_final", "Ser punt d'inici o final de tram", "Ser punto de inicio o final de tramo", "Be the start or end of a stretch"),
            O("avituallament", "Acollir un avituallament", "Acoger un avituallamiento", "Host a refreshment point"),
            O("activitat", "Organitzar una activitat paral·lela", "Organizar una actividad paralela", "Organise a parallel activity"),
            O("difusio", "Ajudar en la difusió local", "Ayudar en la difusión local", "Help with local promotion"),
            O("suport", "Aportar suport econòmic o material", "Aportar apoyo económico o material", "Provide financial or material support"),
          ] },
        { id: "necessitats", tipus: "multi", altre: true, text: T("Si hi hagués una altra edició, què us ajudaria a participar-hi millor?", "Si hubiera otra edición, ¿qué os ayudaría a participar mejor?", "If there were another edition, what would help you take part more easily?"),
          opcions: [
            O("antelacio", "Rebre la informació amb més antelació", "Recibir la información con más antelación", "Receiving information earlier"),
            O("dossier", "Un dossier de comunicació per difondre-ho", "Un dosier de comunicación para difundirlo", "A communications pack to promote it"),
            O("materials", "Materials (cartells, pancartes, senyalització)", "Materiales (carteles, pancartas, señalización)", "Materials (posters, banners, signage)"),
            O("logistica", "Suport logístic de l'organització", "Apoyo logístico de la organización", "Logistical support from the organisers"),
            O("contacte", "Una persona de contacte directa", "Una persona de contacto directa", "A direct contact person"),
            O("res", "Res, va anar bé", "Nada, fue bien", "Nothing, it went well"),
          ] },
      ],
    },
    TANCAMENT(
      T("Si hi hagués una altra edició, voldríeu tornar a participar-hi?", "Si hubiera otra edición, ¿querríais volver a participar?", "If there were another edition, would you like to take part again?"),
      T("Propostes i idees per millorar (recorregut, dates, activitats al municipi…)", "Propuestas e ideas para mejorar (recorrido, fechas, actividades en el municipio…)", "Proposals and ideas for improvement (route, dates, activities in your municipality…)")
    ),
  ],

  // ---------------------------------------------------------------- VOLUNTARIS
  voluntari: [
    {
      id: "rol",
      titol: T("El teu paper", "Tu papel", "Your role"),
      preguntes: [
        { id: "global", tipus: "estrelles", req: true, text: T("Valoració global de l'experiència com a voluntari/ària o organitzador/a", "Valoración global de la experiencia como voluntario/a u organizador/a", "Overall rating of your experience as a volunteer or organiser") },
        { id: "rols", tipus: "multi", altre: true, text: T("Què has fet?", "¿Qué has hecho?", "What did you do?"),
          opcions: [
            O("avituallament", "Avituallament", "Avituallamiento", "Refreshment point"),
            O("material", "Recollida i lliurament de material", "Recogida y entrega de material", "Kit collection and handout"),
            O("seguiment", "Acompanyament o seguiment de trams", "Acompañamiento o seguimiento de tramos", "Escorting or following stretches"),
            O("transport", "Transport i logística", "Transporte y logística", "Transport and logistics"),
            O("seguretat", "Seguretat i control de trànsit", "Seguridad y control de tráfico", "Safety and traffic control"),
            O("comunicacio", "Comunicació, xarxes, foto o vídeo", "Comunicación, redes, foto o vídeo", "Communication, social media, photo or video"),
            O("coordinacio", "Coordinació / organització", "Coordinación / organización", "Coordination / organising"),
          ] },
        { id: "hores", tipus: "unica", text: T("Aproximadament, quantes hores hi has dedicat en total?", "Aproximadamente, ¿cuántas horas le has dedicado en total?", "Roughly how many hours did you give in total?"),
          opcions: [
            O("menys3", "Menys de 3", "Menos de 3", "Under 3"),
            O("3a6", "De 3 a 6", "De 3 a 6", "3 to 6"),
            O("6a12", "De 6 a 12", "De 6 a 12", "6 to 12"),
            O("mes12", "Més de 12", "Más de 12", "Over 12"),
          ] },
      ],
    },
    {
      id: "organitzacio",
      titol: T("Com ha funcionat", "Cómo ha funcionado", "How it worked"),
      preguntes: [
        { id: "briefing", tipus: "estrelles", text: T("Informació i explicació prèvia de la teva tasca", "Información y explicación previa de tu tarea", "Briefing and explanation of your task beforehand") },
        { id: "claredat", tipus: "estrelles", text: T("Claredat de qui feia què i a qui preguntar", "Claridad de quién hacía qué y a quién preguntar", "Clarity about who did what and who to ask") },
        { id: "comunicacio", tipus: "estrelles", text: T("Comunicació amb l'organització durant el repte (grups, telèfons…)", "Comunicación con la organización durante el reto (grupos, teléfonos…)", "Communication with the organisers during the event (groups, phones…)") },
        { id: "seguretat", tipus: "estrelles", na: true, text: T("Seguretat a la teva zona de treball", "Seguridad en tu zona de trabajo", "Safety in your work area") },
        { id: "valorat", tipus: "estrelles", text: T("T'has sentit valorat/ada i part de l'equip?", "¿Te has sentido valorado/a y parte del equipo?", "Did you feel valued and part of the team?") },
        { id: "carrega", tipus: "unica", text: T("La càrrega de feina ha estat…", "La carga de trabajo ha sido…", "The workload was…"),
          opcions: [
            O("poca", "Poca: podia fer més", "Poca: podía hacer más", "Light: I could do more"),
            O("adequada", "Adequada", "Adecuada", "Right"),
            O("massa", "Massa", "Demasiada", "Too much"),
            O("excessiva", "Excessiva", "Excesiva", "Excessive"),
          ] },
        { id: "faltat", tipus: "multi", altre: true, text: T("Què t'ha faltat?", "¿Qué te ha faltado?", "What was missing?"),
          opcions: [
            O("info", "Més informació", "Más información", "More information"),
            O("formacio", "Formació o instruccions", "Formación o instrucciones", "Training or instructions"),
            O("relleus", "Relleus i descansos", "Relevos y descansos", "Rotations and breaks"),
            O("menjar", "Menjar i beure", "Comida y bebida", "Food and drink"),
            O("gent", "Més gent a l'equip", "Más gente en el equipo", "More people on the team"),
            O("comunicacio", "Millor comunicació", "Mejor comunicación", "Better communication"),
            O("res", "Res, tot bé", "Nada, todo bien", "Nothing, all good"),
          ] },
        { id: "incidencia", tipus: "text", text: T("Algun problema o incident que vulguis explicar?", "¿Algún problema o incidente que quieras contar?", "Any problem or incident you want to tell us about?") },
      ],
    },
    {
      id: "futur",
      titol: T("Si hi hagués una altra edició", "Si hubiera otra edición", "If there were another edition"),
      preguntes: [
        { id: "mes_responsabilitat", tipus: "unica", text: T("T'agradaria assumir més responsabilitat (coordinar una zona o un equip)?", "¿Te gustaría asumir más responsabilidad (coordinar una zona o un equipo)?", "Would you like more responsibility (coordinating an area or team)?"), opcions: SI_POTSER_NO },
        { id: "area_futur", tipus: "text", text: T("Si hi hagués una altra edició, en quina àrea t'agradaria ajudar?", "Si hubiera otra edición, ¿en qué área te gustaría ayudar?", "If there were another edition, which area would you like to help with?") },
      ],
    },
    TANCAMENT(
      T("Si hi hagués una altra edició, tornaries a ajudar?", "Si hubiera otra edición, ¿volverías a ayudar?", "If there were another edition, would you help again?"),
      T("Propostes per organitzar-nos millor com a equip", "Propuestas para organizarnos mejor como equipo", "Proposals to organise ourselves better as a team")
    ),
  ],

  // ---------------------------------------------------------------- ENTITATS / COL·LABORADORS / DONANTS
  entitat: [
    {
      id: "relacio",
      titol: T("La vostra col·laboració", "Vuestra colaboración", "Your support"),
      preguntes: [
        { id: "global", tipus: "estrelles", req: true, text: T("Valoració global de l'experiència col·laborant amb el repte", "Valoración global de la experiencia colaborando con el reto", "Overall rating of your experience supporting the challenge") },
        { id: "tipus", tipus: "unica", text: T("Què sou?", "¿Qué sois?", "What are you?"),
          opcions: [
            O("empresa", "Empresa o comerç", "Empresa o comercio", "Company or shop"),
            O("entitat", "Entitat social, cultural o esportiva / club", "Entidad social, cultural o deportiva / club", "Social, cultural or sports organisation / club"),
            O("mitja", "Mitjà de comunicació", "Medio de comunicación", "Media outlet"),
            O("donant", "Persona donant a títol particular", "Persona donante a título particular", "Individual donor"),
          ] },
        { id: "forma", tipus: "multi", altre: true, text: T("Com hi heu col·laborat?", "¿Cómo habéis colaborado?", "How did you support us?"),
          opcions: [
            O("economica", "Aportació econòmica / donatiu", "Aportación económica / donativo", "Financial contribution / donation"),
            O("material", "Material o producte", "Material o producto", "Materials or products"),
            O("serveis", "Serveis (impressió, transport, instal·lacions…)", "Servicios (impresión, transporte, instalaciones…)", "Services (printing, transport, venues…)"),
            O("difusio", "Difusió i comunicació", "Difusión y comunicación", "Promotion and communication"),
            O("voluntaris", "Voluntaris o equip humà", "Voluntarios o equipo humano", "Volunteers or staff"),
          ] },
        { id: "motiu", tipus: "multi", altre: true, text: T("Per què heu volgut col·laborar-hi?", "¿Por qué habéis querido colaborar?", "Why did you want to support it?"),
          opcions: [
            O("causa", "La causa: recerca de la diabetis tipus 1", "La causa: investigación de la diabetes tipo 1", "The cause: type 1 diabetes research"),
            O("social", "Compromís social / responsabilitat corporativa", "Compromiso social / responsabilidad corporativa", "Social commitment / corporate responsibility"),
            O("personal", "Vincle personal amb la diabetis", "Vínculo personal con la diabetes", "Personal connection to diabetes"),
            O("visibilitat", "Visibilitat i imatge", "Visibilidad e imagen", "Visibility and image"),
            O("territori", "Vincle amb el territori i els pobles", "Vínculo con el territorio y los pueblos", "Link to the area and its towns"),
          ] },
      ],
    },
    {
      id: "experiencia",
      titol: T("Com ha anat", "Cómo ha ido", "How it went"),
      preguntes: [
        { id: "comunicacio", tipus: "estrelles", text: T("Comunicació amb l'organització", "Comunicación con la organización", "Communication with the organisers") },
        { id: "claredat", tipus: "estrelles", text: T("Claredat sobre què se us demanava i com col·laborar", "Claridad sobre lo que se os pedía y cómo colaborar", "Clarity about what was asked and how to help") },
        { id: "facilitat", tipus: "estrelles", na: true, text: T("Facilitat dels tràmits (factures, certificats, lliurament…)", "Facilidad de los trámites (facturas, certificados, entrega…)", "Ease of the paperwork (invoices, certificates, delivery…)") },
        { id: "visibilitat", tipus: "estrelles", na: true, text: T("Visibilitat i reconeixement que heu rebut", "Visibilidad y reconocimiento que habéis recibido", "Visibility and recognition you received") },
        { id: "valor", tipus: "estrelles", text: T("Valor que us ha aportat col·laborar-hi", "Valor que os ha aportado colaborar", "Value you got from supporting it") },
        { id: "transparencia", tipus: "estrelles", text: T("Transparència sobre l'ús dels fons (AREDI)", "Transparencia sobre el uso de los fondos (AREDI)", "Transparency about how funds are used (AREDI)") },
        { id: "imatge", tipus: "estrelles", text: T("Imatge i organització general del repte", "Imagen y organización general del reto", "Image and overall organisation of the challenge") },
      ],
    },
    {
      id: "futur",
      titol: T("Si hi hagués una altra edició", "Si hubiera otra edición", "If there were another edition"),
      preguntes: [
        { id: "nivell", tipus: "unica", text: T("Si hi hagués una altra edició, la vostra col·laboració seria…", "Si hubiera otra edición, vuestra colaboración sería…", "If there were another edition, your support would be…"),
          opcions: [
            O("mes", "Més gran", "Mayor", "Bigger"),
            O("igual", "Igual", "Igual", "The same"),
            O("menys", "Més petita", "Menor", "Smaller"),
            O("depen", "Depèn de…", "Depende de…", "Depends on…"),
            O("no", "No col·laboraríem", "No colaboraríamos", "We wouldn't take part"),
          ] },
        { id: "facilitaria", tipus: "multi", altre: true, text: T("Si hi hagués una altra edició, què us facilitaria col·laborar-hi més?", "Si hubiera otra edición, ¿qué os facilitaría colaborar más?", "If there were another edition, what would make it easier to support us more?"),
          opcions: [
            O("antelacio", "Rebre la proposta amb més antelació", "Recibir la propuesta con más antelación", "Receiving the proposal earlier"),
            O("fiscal", "Certificat per a deduccions fiscals", "Certificado para deducciones fiscales", "Certificate for tax deductions"),
            O("visibilitat", "Més visibilitat", "Más visibilidad", "More visibility"),
            O("informe", "Un informe d'impacte i de resultats", "Un informe de impacto y resultados", "An impact and results report"),
            O("contacte", "Un contacte directe a l'organització", "Un contacto directo en la organización", "A direct contact at the organisation"),
            O("activitats", "Activitats conjuntes amb el nostre equip", "Actividades conjuntas con nuestro equipo", "Joint activities with our team"),
          ] },
        { id: "informe_vol", tipus: "unica", text: T("Voleu rebre l'informe de resultats i l'import recaptat?", "¿Queréis recibir el informe de resultados y el importe recaudado?", "Would you like to receive the results report and total raised?"),
          opcions: [O("si", "Sí", "Sí", "Yes"), O("no", "No cal", "No hace falta", "Not necessary")] },
      ],
    },
    TANCAMENT(
      T("Si hi hagués una altra edició, tornaríeu a col·laborar-hi?", "Si hubiera otra edición, ¿volveríais a colaborar?", "If there were another edition, would you support us again?"),
      T("Propostes i idees (com col·laborar millor, accions conjuntes…)", "Propuestas e ideas (cómo colaborar mejor, acciones conjuntas…)", "Proposals and ideas (how to work better together, joint actions…)")
    ),
  ],
};

// Preguntes finals comunes a tots (autorització i contacte): s'afegeixen
// al final de cada grup des de la pàgina i es validen aquí.
const CONTACTE = {
  autoritzacio: {
    id: "autoritzacio", tipus: "unica",
    text: T("Podem fer servir la teva opinió per comunicar els resultats?", "¿Podemos usar tu opinión para comunicar los resultados?", "May we use your feedback when we report the results?"),
    opcions: [
      O("anonim", "Sí, de forma anònima", "Sí, de forma anónima", "Yes, anonymously"),
      O("nom", "Sí, amb el meu nom", "Sí, con mi nombre", "Yes, with my name"),
      O("no", "No, només per a ús intern", "No, solo para uso interno", "No, internal use only"),
    ],
  },
  contactar: {
    id: "contactar", tipus: "unica",
    text: T("Et podem trucar o escriure per parlar-ne més a fons?", "¿Podemos llamarte o escribirte para hablarlo más a fondo?", "May we contact you to talk about it in more depth?"),
    opcions: [O("si", "Sí", "Sí", "Yes"), O("no", "No", "No", "No")],
  },
};

const GRUPS_IDS = Object.keys(GRUPS);

function preguntesDelGrup(grup) {
  const out = [];
  for (const s of SECCIONS[grup] || []) for (const p of s.preguntes) out.push(p);
  out.push(CONTACTE.autoritzacio, CONTACTE.contactar);
  return out;
}

function definicio() {
  return { grups: GRUPS, perfil: PERFIL, seccions: SECCIONS, contacte: CONTACTE };
}

module.exports = { GRUPS, GRUPS_IDS, PERFIL, SECCIONS, CONTACTE, SI_POTSER_NO, preguntesDelGrup, definicio };
