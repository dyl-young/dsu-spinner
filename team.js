// Team roster for the Productivity Engineering DSU.
// Taken from the "Productivity Engineering Standup" calendar invite; Jira account IDs
// come from issue assignees on the GEN and IOP projects.
// To change the team, edit this file and click the reload icon on chrome://extensions.

export const JIRA_BASE = 'https://impact.atlassian.net';

export const BOARDS = {
  GEN: {
    key: 'GEN',
    name: 'GenAI Productivity',
    url: `${JIRA_BASE}/jira/software/projects/GEN/boards/5914`,
  },
  IOP: {
    key: 'IOP',
    name: 'iTools',
    url: `${JIRA_BASE}/jira/software/projects/IOP/boards/1846`,
  },
};

// boards[0] is the person's main board, the one their name links to.
// jiraName is their display name in Jira when it differs from fullName; the board's
// assignee filter is matched on it (and on the account ID in the avatar URL).
export const TEAM = [
  // GenAI Productivity
  { id: 'dylan',   name: 'Dylan',   fullName: 'Dylan Young',        accountId: '712020:4a73290d-ff4f-4029-9661-8f62d812fa4f', boards: ['GEN'] },
  { id: 'taku',    name: 'Taku',    fullName: 'Takudzwa Makusha',   accountId: '712020:546a604c-2761-4267-b161-683228bf8863', boards: ['GEN'] },
  { id: 'tian',    name: 'Tian',    fullName: 'Tian Schoeman',      accountId: '61a0dc252278e7006bdfab33',                    boards: ['GEN'] },
  { id: 'khanya',  name: 'Khanya',  fullName: 'Khanya Lugongolo',   accountId: '712020:f7eba0fa-d27f-4d32-925c-088050375dea', boards: ['GEN'] },
  { id: 'nika',    name: 'Nika',    fullName: 'Nika Hofmeyr',       accountId: '712020:9f898d8d-371c-45a3-b6b0-1b7d926884b9', boards: ['GEN'] },
  { id: 'rowan',   name: 'Rowan',   fullName: 'Rowan Cowper',       accountId: '712020:b55a5704-282d-48e4-ac7e-879df2879a7a', boards: ['GEN'] },
  { id: 'ewald',   name: 'Ewald',   fullName: 'Ewald Fourie',       accountId: '712020:4bd8500d-2e46-4324-9227-11fabe878af8', boards: ['GEN'] },
  { id: 'chris',   name: 'Chris',   fullName: 'Chris Langebrink',   accountId: '712020:f995367a-22c8-4be9-b516-6a99b6432bb5', boards: ['GEN', 'IOP'] },

  // iTools
  { id: 'bobby',   name: 'Bobby',   fullName: 'Bobby Fang',         accountId: '712020:8f820621-5c30-494e-95da-3bc3fed57d74', boards: ['IOP'] },
  { id: 'anthony', name: 'Anthony', fullName: 'Anthony Goble',      accountId: '712020:278330bd-ccfa-4f4f-97d0-e20255e0a72d', boards: ['IOP'] },
  { id: 'deony',   name: 'Deony',   fullName: 'Deony Barrington',   accountId: '712020:f0a6e276-1781-4dfa-8bc1-6259ea863a23', boards: ['IOP'] },
  { id: 'hanlie',  name: 'Hanlie',  fullName: 'Hannelize Bester',   jiraName: 'Hanlie Bester',   accountId: '557058:887063c1-bf45-4852-a530-315d0dbbb22d', boards: ['IOP'] },
  { id: 'megan',   name: 'Megan',   fullName: 'Megan Bodley',       accountId: '712020:8d954cfa-3cd4-4eb3-8b59-1e9ef573c4e7', boards: ['IOP'] },
  { id: 'evert',   name: 'Evert',   fullName: 'Evert Scott',        accountId: '60366e19f0327400686fedc6',                    boards: ['IOP'] },
  { id: 'casey',   name: 'Casey',   fullName: 'Casey-lea Olson',    accountId: '712020:6c887f02-f2f5-4def-837c-2b216bcc5bc2', boards: ['IOP', 'GEN'] },
  { id: 'nicole',  name: 'Nicole',  fullName: 'Nicole Du Toit',     accountId: '6218b50d8e1bf00069321529',                    boards: ['IOP'] },
  { id: 'chanre',  name: 'Chanré',  fullName: 'Chanré Bosch',       accountId: '612e5d5944c8ed00687aa7eb',                    boards: ['IOP'] },
];

export function boardUrl(boardKey, accountId) {
  const board = BOARDS[boardKey];
  return `${board.url}?assignee=${encodeURIComponent(accountId)}`;
}
