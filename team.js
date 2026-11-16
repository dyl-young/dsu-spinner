// Starting team for the Productivity Engineering DSU, taken from the
// "Productivity Engineering Standup" calendar invite.
// The PM adds and removes people in the spinner's settings; once they do, the team is
// saved in the extension and this list isn't used any more. Squads can only be changed here.

export const SQUADS = [
  { id: 'genai', name: 'GenAI Productivity' },
  { id: 'itools', name: 'iTools' },
];

export const DEFAULT_TEAM = [
  { id: 'dylan',   name: 'Dylan',   squad: 'genai' },
  { id: 'taku',    name: 'Taku',    squad: 'genai' },
  { id: 'tian',    name: 'Tian',    squad: 'genai' },
  { id: 'khanya',  name: 'Khanya',  squad: 'genai' },
  { id: 'nika',    name: 'Nika',    squad: 'genai' },
  { id: 'rowan',   name: 'Rowan',   squad: 'genai' },
  { id: 'ewald',   name: 'Ewald',   squad: 'genai' },
  { id: 'chris',   name: 'Chris',   squad: 'genai' },

  { id: 'bobby',   name: 'Bobby',   squad: 'itools' },
  { id: 'anthony', name: 'Anthony', squad: 'itools' },
  { id: 'deony',   name: 'Deony',   squad: 'itools' },
  { id: 'hanlie',  name: 'Hanlie',  squad: 'itools' },
  { id: 'megan',   name: 'Megan',   squad: 'itools' },
  { id: 'evert',   name: 'Evert',   squad: 'itools' },
  { id: 'casey',   name: 'Casey',   squad: 'itools' },
  { id: 'nicole',  name: 'Nicole',  squad: 'itools' },
  { id: 'chanre',  name: 'Chanré',  squad: 'itools' },
];
