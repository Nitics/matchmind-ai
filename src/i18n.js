/**
 * MatchMind AI - Multilingual commentary templates
 *
 * Supported languages: en (English), es (Spanish), fr (French), pt (Portuguese), de (German)
 * Templates use {placeholders} filled from event data. The template engine is
 * the deterministic baseline; the optional Azure OpenAI layer (llm.js) can
 * polish wording on top of these grounded facts.
 */

const LANGUAGES = ['en', 'es', 'fr', 'pt', 'de'];

const T = {
  en: {
    kickoff: "We're under way! {home} host {away}.",
    goal: 'GOAL! {player} scores for {team}! {homeShort} {h}-{a} {awayShort}.',
    goalAssist: 'GOAL! {player} finishes it off after great work from {assist}! {homeShort} {h}-{a} {awayShort}.',
    bigChance: 'Huge chance for {player}! (xG {xg})',
    save: 'Brilliant stop by {player}!',
    yellow_card: 'Yellow card for {player} ({team}).',
    red_card: 'RED CARD! {player} is sent off - {team} are down to ten.',
    secondYellow: 'Second yellow for {player} - he has to go! {team} down to ten.',
    substitution: '{team} change: {on} replaces {off}.',
    half_time: 'Half-time: {homeShort} {h}-{a} {awayShort}.',
    full_time: "Full-time! {homeShort} {h}-{a} {awayShort}.",
    recapWin: '{winner} beat {loser} {score}.',
    recapDraw: '{home} and {away} shared the points in a {score} draw.',
    keyMoment: 'Key moment',
    potm: 'Player of the match',
    stats: 'Stats',
    goals: 'Goals',
    tacticalRead: 'Tactical read',
    shots: 'Shots',
    onTarget: 'On target',
    possession: 'Possession',
  },
  es: {
    kickoff: '¡Arranca el partido! {home} recibe a {away}.',
    goal: '¡GOL! ¡{player} marca para {team}! {homeShort} {h}-{a} {awayShort}.',
    goalAssist: '¡GOL! ¡{player} define tras una gran jugada de {assist}! {homeShort} {h}-{a} {awayShort}.',
    bigChance: '¡Ocasión clarísima para {player}! (xG {xg})',
    save: '¡Paradón de {player}!',
    yellow_card: 'Tarjeta amarilla para {player} ({team}).',
    red_card: '¡TARJETA ROJA! {player} es expulsado; {team} se queda con diez.',
    secondYellow: 'Segunda amarilla para {player}, ¡a la calle! {team} con diez.',
    substitution: 'Cambio en {team}: entra {on}, sale {off}.',
    half_time: 'Descanso: {homeShort} {h}-{a} {awayShort}.',
    full_time: '¡Final del partido! {homeShort} {h}-{a} {awayShort}.',
    recapWin: '{winner} venció a {loser} por {score}.',
    recapDraw: '{home} y {away} empataron {score}.',
    keyMoment: 'Momento clave',
    potm: 'Jugador del partido',
    stats: 'Estadísticas',
    goals: 'Goles',
    tacticalRead: 'Lectura táctica',
    shots: 'Tiros',
    onTarget: 'A puerta',
    possession: 'Posesión',
  },
  fr: {
    kickoff: "C'est parti ! {home} reçoit {away}.",
    goal: 'BUT ! {player} marque pour {team} ! {homeShort} {h}-{a} {awayShort}.',
    goalAssist: 'BUT ! {player} conclut après un superbe travail de {assist} ! {homeShort} {h}-{a} {awayShort}.',
    bigChance: 'Énorme occasion pour {player} ! (xG {xg})',
    save: 'Superbe arrêt de {player} !',
    yellow_card: 'Carton jaune pour {player} ({team}).',
    red_card: 'CARTON ROUGE ! {player} est expulsé, {team} réduit à dix.',
    secondYellow: 'Deuxième jaune pour {player}, il doit sortir ! {team} à dix.',
    substitution: 'Changement pour {team} : {on} remplace {off}.',
    half_time: 'Mi-temps : {homeShort} {h}-{a} {awayShort}.',
    full_time: 'Coup de sifflet final ! {homeShort} {h}-{a} {awayShort}.',
    recapWin: '{winner} a battu {loser} {score}.',
    recapDraw: '{home} et {away} se sont quittés sur un nul {score}.',
    keyMoment: 'Moment clé',
    potm: 'Homme du match',
    stats: 'Statistiques',
    goals: 'Buts',
    tacticalRead: 'Lecture tactique',
    shots: 'Tirs',
    onTarget: 'Cadrés',
    possession: 'Possession',
  },
  pt: {
    kickoff: 'Começa o jogo! {home} recebe o {away}.',
    goal: 'GOL! {player} marca para o {team}! {homeShort} {h}-{a} {awayShort}.',
    goalAssist: 'GOL! {player} finaliza após grande jogada de {assist}! {homeShort} {h}-{a} {awayShort}.',
    bigChance: 'Chance enorme para {player}! (xG {xg})',
    save: 'Grande defesa de {player}!',
    yellow_card: 'Cartão amarelo para {player} ({team}).',
    red_card: 'CARTÃO VERMELHO! {player} é expulso, o {team} fica com dez.',
    secondYellow: 'Segundo amarelo para {player}, expulso! {team} com dez.',
    substitution: 'Substituição no {team}: entra {on}, sai {off}.',
    half_time: 'Intervalo: {homeShort} {h}-{a} {awayShort}.',
    full_time: 'Fim de jogo! {homeShort} {h}-{a} {awayShort}.',
    recapWin: '{winner} venceu o {loser} por {score}.',
    recapDraw: '{home} e {away} empataram por {score}.',
    keyMoment: 'Momento decisivo',
    potm: 'Melhor em campo',
    stats: 'Estatísticas',
    goals: 'Gols',
    tacticalRead: 'Leitura tática',
    shots: 'Finalizações',
    onTarget: 'No alvo',
    possession: 'Posse',
  },
  de: {
    kickoff: 'Anpfiff! {home} empfängt {away}.',
    goal: 'TOR! {player} trifft für {team}! {homeShort} {h}:{a} {awayShort}.',
    goalAssist: 'TOR! {player} vollendet nach starker Vorarbeit von {assist}! {homeShort} {h}:{a} {awayShort}.',
    bigChance: 'Riesenchance für {player}! (xG {xg})',
    save: 'Starke Parade von {player}!',
    yellow_card: 'Gelbe Karte für {player} ({team}).',
    red_card: 'ROTE KARTE! {player} fliegt vom Platz, {team} nur noch zu zehnt.',
    secondYellow: 'Gelb-Rot für {player}! {team} nur noch zu zehnt.',
    substitution: 'Wechsel bei {team}: {on} kommt für {off}.',
    half_time: 'Halbzeit: {homeShort} {h}:{a} {awayShort}.',
    full_time: 'Abpfiff! {homeShort} {h}:{a} {awayShort}.',
    recapWin: '{winner} schlägt {loser} {score}.',
    recapDraw: '{home} und {away} trennen sich {score}.',
    keyMoment: 'Schlüsselmoment',
    potm: 'Spieler des Spiels',
    stats: 'Statistiken',
    goals: 'Tore',
    tacticalRead: 'Taktische Analyse',
    shots: 'Schüsse',
    onTarget: 'Aufs Tor',
    possession: 'Ballbesitz',
  },
};

function t(lang, key, vars = {}) {
  if (!LANGUAGES.includes(lang)) throw new Error(`Unsupported language: ${lang}. Use one of ${LANGUAGES.join(', ')}`);
  const tpl = T[lang][key];
  if (tpl === undefined) throw new Error(`Missing template key: ${key}`);
  return tpl.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : `{${k}}`));
}

module.exports = { t, LANGUAGES };
