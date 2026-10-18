/**
 * Fictional teams and players for synthetic match generation.
 * All names are invented - no real clubs or players are represented.
 */

const squad = (names, bench) => ({
  players: [
    { name: names[0], pos: 'GK' },
    ...names.slice(1, 5).map((n) => ({ name: n, pos: 'DEF' })),
    ...names.slice(5, 8).map((n) => ({ name: n, pos: 'MID' })),
    ...names.slice(8, 11).map((n) => ({ name: n, pos: 'FWD' })),
  ],
  bench,
});

const TEAMS = {
  RVR: {
    id: 'RVR', name: 'Riverside Rovers', short: 'Rovers', rating: 82,
    ...squad(
      ['T. Okafor', 'L. Brandt', 'M. Silva', 'J. Hale', 'D. Kowalski', 'A. Mensah', 'R. Iwata', 'C. Duarte', 'K. Achterberg', 'S. Nwosu', 'E. Lindqvist'],
      ['P. Varga', 'O. Fenn', 'Y. Haddad', 'B. Moreau', 'N. Eriksen']
    ),
  },
  HLU: {
    id: 'HLU', name: 'Harbour Lights United', short: 'United', rating: 79,
    ...squad(
      ['G. Mbeki', 'F. Castell', 'H. Ruiz', 'W. Adeyemi', 'Z. Novak', 'I. Petrov', 'V. Laine', 'Q. Marsh', 'U. Ferreira', 'X. Tanaka', 'J. Oduya'],
      ['M. Keane', 'L. Sato', 'R. Diallo', 'T. Vidal', 'A. Horvat']
    ),
  },
  NFC: {
    id: 'NFC', name: 'Northgate FC', short: 'Northgate', rating: 76,
    ...squad(
      ['B. Stroud', 'C. Ngata', 'E. Hollis', 'F. Abara', 'G. Lund', 'H. Okoro', 'I. Brennan', 'J. Salas', 'K. Mwangi', 'L. Ferro', 'M. Quist'],
      ['N. Ashby', 'O. Kamara', 'P. Linde', 'Q. Roche', 'R. Ilic']
    ),
  },
  CVA: {
    id: 'CVA', name: 'Crown Valley Athletic', short: 'Athletic', rating: 74,
    ...squad(
      ['S. Dahl', 'T. Ombati', 'U. Grau', 'V. Hart', 'W. Sesay', 'X. Molina', 'Y. Brook', 'Z. Ekwe', 'A. Rossi', 'B. Zulu', 'C. Faraday'],
      ['D. Nkosi', 'E. Pike', 'F. Imai', 'G. Torres', 'H. Bello']
    ),
  },
};

module.exports = { TEAMS };
