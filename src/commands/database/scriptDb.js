import Database from "better-sqlite3";
import crypto from "crypto";

const db = new Database("dbBets.sqlite");
db.pragma("foreign_keys = ON");

function colMissing(table, col) {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all();
  return !rows.some((r) => r.name === col);
}

function setupDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS bettors (
      discordID TEXT PRIMARY KEY,
      nbPoints INTEGER NOT NULL DEFAULT 0,
      betSuccess INTEGER NOT NULL DEFAULT 0,
      totalBet INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS bets (
      idBet TEXT PRIMARY KEY,
      bet1Name TEXT NOT NULL,
      bet2Name TEXT NOT NULL,
      cotationBet1 REAL NOT NULL,
      cotationBet2 REAL NOT NULL,
      result TEXT CHECK(result IN ('bet1','bet2','void')),
      createdAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS wagers (
      wagerID TEXT PRIMARY KEY,
      idBet TEXT NOT NULL,
      discordID TEXT NOT NULL,
      side TEXT NOT NULL CHECK(side IN ('bet1','bet2')),
      stake INTEGER NOT NULL,
      odds REAL NOT NULL,
      placedAt INTEGER NOT NULL,
      payout INTEGER,
      outcome TEXT CHECK(outcome IN ('win','lose','void')),
      FOREIGN KEY (idBet) REFERENCES bets(idBet) ON DELETE CASCADE,
      FOREIGN KEY (discordID) REFERENCES bettors(discordID) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_wagers_bet ON wagers(idBet);
    CREATE INDEX IF NOT EXISTS idx_wagers_user ON wagers(discordID);
  `);

  const alters = [];
  if (colMissing("bets", "status"))
    alters.push(`ALTER TABLE bets ADD COLUMN status TEXT DEFAULT 'open'`);
  if (colMissing("bets", "updatedAt"))
    alters.push(`ALTER TABLE bets ADD COLUMN updatedAt INTEGER`);
  if (colMissing("bets", "settledAt"))
    alters.push(`ALTER TABLE bets ADD COLUMN settledAt INTEGER`);
  if (colMissing("bets", "lockAt"))
    alters.push(`ALTER TABLE bets ADD COLUMN lockAt INTEGER`);
  if (colMissing("bets", "minStake"))
    alters.push(`ALTER TABLE bets ADD COLUMN minStake INTEGER DEFAULT 1`);
  if (colMissing("bets", "maxStake"))
    alters.push(`ALTER TABLE bets ADD COLUMN maxStake INTEGER DEFAULT 1000000`);
  if (colMissing("bets", "suspendReason"))
    alters.push(`ALTER TABLE bets ADD COLUMN suspendReason TEXT`);

  for (const sql of alters) db.exec(sql);

  db.exec(
    `CREATE UNIQUE INDEX IF NOT EXISTS uq_wagers_user_bet ON wagers(discordID, idBet)`
  );

  console.log("✅ Base de données prête !");
}

setupDatabase();

export default db;

//   BETTORS

function getBettor(discordID) {
  const stmt = db.prepare(`SELECT * FROM bettors WHERE discordID = ?`);
  let user = stmt.get(discordID);

  if (!user) {
    const insert = db.prepare(`INSERT INTO bettors (discordID) VALUES (?)`);
    insert.run(discordID);

    user = {
      discordID,
      nbPoints: 0,
      betSuccess: 0,
      totalBet: 0,
    };
  }

  return user;
}

function setBettor(discordID, nbPoints, betSuccess, totalBet) {
  const stmt = db.prepare(
    `
    INSERT INTO bettors (discordID, nbPoints, betSuccess, totalBet)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(discordID) DO UPDATE SET
      nbPoints = excluded.nbPoints,
      betSuccess = excluded.betSuccess,
      totalBet = excluded.totalBet;
  `
  );

  stmt.run(discordID, nbPoints, betSuccess, totalBet);
}

function getLeaderboard(limit = 10) {
  const stmt = db.prepare(`
    SELECT discordID, nbPoints, betSuccess, totalBet
    FROM bettors
    ORDER BY nbPoints DESC
    LIMIT ?
  `);
  return stmt.all(limit);
}

//   BETS

function getBet(idBet) {
  const stmt = db.prepare(`SELECT * FROM bets WHERE idBet = ?`);
  return stmt.get(idBet) ?? null;
}

function createBet(bet1Name, bet2Name, cotationBet1, cotationBet2) {
  const idBet = crypto.randomUUID();
  const createdAt = Date.now();

  const stmt = db.prepare(
    `
    INSERT INTO bets (
      idBet, bet1Name, bet2Name,
      cotationBet1, cotationBet2,
      result, createdAt
    )
    VALUES (?, ?, ?, ?, ?, NULL, ?)
  `
  );

  stmt.run(idBet, bet1Name, bet2Name, cotationBet1, cotationBet2, createdAt);

  return idBet;
}

function getActiveBets() {
  const stmt = db.prepare(`
    SELECT *
    FROM bets
    WHERE result IS NULL
    ORDER BY createdAt DESC
  `);

  return stmt.all();
}

// result = "bet1" | "bet2" | "void"
function setBetResult(idBet, result) {
  const bet = getBet(idBet);
  if (!bet) throw new Error("❌ Bet introuvable");
  if (bet.result) throw new Error("❌ Ce bet est déjà réglé");

  const wagers = db.prepare(`SELECT * FROM wagers WHERE idBet = ?`).all(idBet);

  const updateWager = db.prepare(`
    UPDATE wagers
    SET payout = ?, outcome = ?
    WHERE wagerID = ?
  `);

  const updateUserWin = db.prepare(`
    UPDATE bettors
    SET nbPoints = nbPoints + ?, betSuccess = betSuccess + 1
    WHERE discordID = ?
  `);

  const updateUserVoid = db.prepare(`
    UPDATE bettors
    SET nbPoints = nbPoints + ?
    WHERE discordID = ?
  `);

  for (const w of wagers) {
    if (result === "void") {
      updateWager.run(w.stake, "void", w.wagerID);
      updateUserVoid.run(w.stake, w.discordID);
      continue;
    }

    if (w.side === result) {
      const payout = Math.floor(w.stake * w.odds);
      updateWager.run(payout, "win", w.wagerID);
      updateUserWin.run(payout, w.discordID);
    } else {
      updateWager.run(0, "lose", w.wagerID);
    }
  }

  const now = Date.now();
  db.prepare(
    `
    UPDATE bets
    SET result = ?, settledAt = ?, updatedAt = ?
    WHERE idBet = ?
  `
  ).run(result, now, now, idBet);
}

function deleteBet(idBet) {
  const stmt = db.prepare(`DELETE FROM bets WHERE idBet = ?`);
  return stmt.run(idBet).changes;
}

function getUserHistory(discordID) {
  const stmt = db.prepare(`
    SELECT
      w.*,
      b.bet1Name,
      b.bet2Name,
      b.cotationBet1,
      b.cotationBet2,
      b.result
    FROM wagers w
    JOIN bets b ON b.idBet = w.idBet
    WHERE w.discordID = ?
    ORDER BY w.placedAt DESC
  `);

  return stmt.all(discordID);
}

//   WAGERS

function getWagers(idBet) {
  const stmt = db.prepare(`
    SELECT *
    FROM wagers
    WHERE idBet = ?
    ORDER BY placedAt DESC
  `);
  return stmt.all(idBet);
}

function getUserWager(idBet, discordID) {
  const stmt = db.prepare(`
    SELECT *
    FROM wagers
    WHERE idBet = ? AND discordID = ?
    LIMIT 1
  `);

  return stmt.get(idBet, discordID) ?? null;
}

function placeWager(idBet, discordID, side, stake, odds) {
  const wagerID = crypto.randomUUID();
  const placedAt = Date.now();

  const stmt = db.prepare(
    `
    INSERT INTO wagers (
      wagerID, idBet, discordID, side, stake, odds, placedAt
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `
  );

  try {
    stmt.run(wagerID, idBet, discordID, side, stake, odds, placedAt);

    db.prepare(
      `
      UPDATE bettors
      SET totalBet = totalBet + 1
      WHERE discordID = ?
    `
    ).run(discordID);
  } catch (err) {
    if (String(err).includes("uq_wagers_user_bet")) {
      throw new Error("⚠️ Tu as déjà une mise sur ce pari.");
    }
    throw err;
  }

  return wagerID;
}

function removeWager(wagerID) {
  const stmt = db.prepare(`DELETE FROM wagers WHERE wagerID = ?`);
  stmt.run(wagerID);
}

export {
  db,
  // bettors
  getBettor,
  setBettor,
  getLeaderboard,

  // bets
  getBet,
  createBet,
  setBetResult,
  deleteBet,
  getActiveBets,
  getUserHistory,

  // wagers
  getWagers,
  getUserWager,
  placeWager,
  removeWager,
};
