import Database from "better-sqlite3";

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
