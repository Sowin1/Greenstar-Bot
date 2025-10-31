import Database from "better-sqlite3";
import crypto from "crypto";

const db = new Database("dbBets.sqlite");
db.pragma("foreign_keys = ON");

function setupDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS teams (
      idTeam TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL COLLATE NOCASE,
      logoUrl TEXT
    );

    CREATE TABLE IF NOT EXISTS bettors (
      discordID TEXT PRIMARY KEY,
      nbPoints INTEGER NOT NULL DEFAULT 0,
      betSuccess INTEGER NOT NULL DEFAULT 0,
      totalBet INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS bets (
      idBet TEXT PRIMARY KEY,
      bet1ID TEXT NOT NULL,
      bet2ID TEXT NOT NULL,
      cotationBet1 REAL NOT NULL,
      cotationBet2 REAL NOT NULL,
      result TEXT CHECK(result IN ('bet1','bet2','void')),
      createdAt INTEGER NOT NULL,
      status TEXT,
      updatedAt INTEGER,
      settledAt INTEGER,
      lockAt INTEGER,
      minStake INTEGER DEFAULT 1,
      maxStake INTEGER DEFAULT 1000000,
      suspendReason TEXT,
      FOREIGN KEY (bet1ID) REFERENCES teams(idTeam),
      FOREIGN KEY (bet2ID) REFERENCES teams(idTeam)
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

    CREATE UNIQUE INDEX IF NOT EXISTS uq_wagers_user_bet ON wagers(discordID, idBet);
  `);

  console.log("✅ Base de données prête !");
}
setupDatabase();

export default db;

/* -----------------------------------------
   TEAMS
------------------------------------------ */

function getTeamStats(teamName) {
  const name = teamName.trim().toLowerCase();

  const bets = db
    .prepare(
      `
      SELECT bet1Name, bet2Name, result
      FROM bets
      WHERE result IS NOT NULL
    `
    )
    .all();

  let wins = 0;
  let losses = 0;
  let voids = 0;

  for (const b of bets) {
    const team1 = b.bet1Name.trim().toLowerCase();
    const team2 = b.bet2Name.trim().toLowerCase();

    if (b.result === "void") {
      if (team1 === name || team2 === name) voids++;
      continue;
    }

    if (team1 === name) {
      if (b.result === "bet1") wins++;
      else losses++;
    }

    if (team2 === name) {
      if (b.result === "bet2") wins++;
      else losses++;
    }
  }

  return { wins, losses, voids };
}

function getTeamByName(name) {
  return (
    db.prepare(`SELECT * FROM teams WHERE name = ?`).get(name.trim()) ?? null
  );
}

function getTeams() {
  return db.prepare(`SELECT * FROM teams ORDER BY name ASC`).all();
}

function createOrUpdateTeam(name, logoUrl = null) {
  const existing = db
    .prepare(`SELECT * FROM teams WHERE name = ?`)
    .get(name.trim());

  if (existing) {
    if (logoUrl) {
      db.prepare(
        `
        UPDATE teams
        SET logoUrl = ?
        WHERE idTeam = ?
      `
      ).run(logoUrl, existing.idTeam);
    }
    return existing.idTeam;
  }

  const idTeam = crypto.randomUUID();

  db.prepare(
    `INSERT INTO teams (idTeam, name, logoUrl)
     VALUES (?, ?, ?)`
  ).run(idTeam, name, logoUrl);

  return idTeam;
}

/* -----------------------------------------
   BETTORS
------------------------------------------ */

function getBettor(discordID) {
  let user = db
    .prepare(`SELECT * FROM bettors WHERE discordID = ?`)
    .get(discordID);

  if (!user) {
    db.prepare(`INSERT INTO bettors (discordID) VALUES (?)`).run(discordID);
    user = { discordID, nbPoints: 0, betSuccess: 0, totalBet: 0 };
  }
  return user;
}

function setBettor(discordID, nbPoints, betSuccess, totalBet) {
  db.prepare(
    `
    INSERT INTO bettors (discordID, nbPoints, betSuccess, totalBet)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(discordID) DO UPDATE SET
      nbPoints = excluded.nbPoints,
      betSuccess = excluded.betSuccess,
      totalBet = excluded.totalBet;
  `
  ).run(discordID, nbPoints, betSuccess, totalBet);
}

function getLeaderboard(limit = 10) {
  return db
    .prepare(
      `SELECT discordID, nbPoints, betSuccess, totalBet
       FROM bettors
       ORDER BY nbPoints DESC
       LIMIT ?`
    )
    .all(limit);
}

/* -----------------------------------------
   BETS
------------------------------------------ */

function getBet(idBet) {
  return db.prepare(`SELECT * FROM bets WHERE idBet = ?`).get(idBet) ?? null;
}

function createBet(bet1ID, bet2ID, cotationBet1, cotationBet2) {
  const idBet = crypto.randomUUID();
  const createdAt = Date.now();
  const status = "open";

  db.prepare(
    `INSERT INTO bets (
      idBet, bet1ID, bet2ID, cotationBet1, cotationBet2, createdAt, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(idBet, bet1ID, bet2ID, cotationBet1, cotationBet2, createdAt, status);

  return idBet;
}

function getActiveBets() {
  return db
    .prepare(
      `SELECT
        b.*,
        t1.name AS team1,
        t2.name AS team2,
        COALESCE(SUM(CASE WHEN w.side='bet1' THEN w.stake END), 0) AS stake1,
        COALESCE(SUM(CASE WHEN w.side='bet2' THEN w.stake END), 0) AS stake2
      FROM bets b
      JOIN teams t1 ON t1.idTeam = b.bet1ID
      JOIN teams t2 ON t2.idTeam = b.bet2ID
      LEFT JOIN wagers w ON w.idBet = b.idBet
      WHERE b.status = 'open'
      GROUP BY b.idBet
      ORDER BY b.createdAt DESC`
    )
    .all();
}

function setBetResult(idBet, result) {
  const bet = getBet(idBet);
  if (!bet) throw new Error("❌ Bet introuvable");
  if (bet.result) throw new Error("❌ Ce bet est déjà réglé");

  const wagers = db.prepare(`SELECT * FROM wagers WHERE idBet = ?`).all(idBet);

  const updateWager = db.prepare(
    `UPDATE wagers SET payout = ?, outcome = ? WHERE wagerID = ?`
  );
  const updateUserWin = db.prepare(
    `UPDATE bettors SET nbPoints = nbPoints + ?, betSuccess = betSuccess + 1 WHERE discordID = ?`
  );
  const updateUserVoid = db.prepare(
    `UPDATE bettors SET nbPoints = nbPoints + ? WHERE discordID = ?`
  );

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
    `UPDATE bets
     SET result = ?, settledAt = ?, updatedAt = ?
     WHERE idBet = ?`
  ).run(result, now, now, idBet);
}

function deleteBet(idBet) {
  return db.prepare(`DELETE FROM bets WHERE idBet = ?`).run(idBet).changes;
}

function getUserHistory(discordID) {
  return db
    .prepare(
      `SELECT
        w.*,
        t1.name AS team1,
        t2.name AS team2,
        b.cotationBet1,
        b.cotationBet2,
        b.result
      FROM wagers w
      JOIN bets b ON b.idBet = w.idBet
      JOIN teams t1 ON t1.idTeam = b.bet1ID
      JOIN teams t2 ON t2.idTeam = b.bet2ID
      WHERE w.discordID = ?
      ORDER BY w.placedAt DESC`
    )
    .all(discordID);
}

/* -----------------------------------------
   WAGERS
------------------------------------------ */

function getWagers(idBet) {
  return db
    .prepare(
      `SELECT *
       FROM wagers
       WHERE idBet = ?
       ORDER BY placedAt DESC`
    )
    .all(idBet);
}

function getUserWager(idBet, discordID) {
  return (
    db
      .prepare(`SELECT * FROM wagers WHERE idBet = ? AND discordID = ? LIMIT 1`)
      .get(idBet, discordID) ?? null
  );
}

function placeWager(idBet, discordID, side, stake, odds) {
  const wagerID = crypto.randomUUID();
  const placedAt = Date.now();

  try {
    db.prepare(
      `INSERT INTO wagers (
        wagerID, idBet, discordID, side, stake, odds, placedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(wagerID, idBet, discordID, side, stake, odds, placedAt);

    db.prepare(
      `UPDATE bettors SET totalBet = totalBet + 1 WHERE discordID = ?`
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
  db.prepare(`DELETE FROM wagers WHERE wagerID = ?`).run(wagerID);
}

export {
  db,

  // teams
  getTeamStats,
  getTeamByName,
  createOrUpdateTeam,
  getTeams,

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
