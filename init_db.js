const pool = require('./db');

const initializeDB = async () => {
    console.log("Pool object:", pool);
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query("DROP TABLE IF EXISTS Players CASCADE");
        await client.query("DROP TABLE IF EXISTS Teams CASCADE");
        await client.query('DROP TABLE IF EXISTS Trade_Details CASCADE');
        await client.query('DROP TABLE IF EXISTS Trades CASCADE');

        await client.query(`CREATE TABLE Teams (
            team_id SERIAL PRIMARY KEY,
            team_code VARCHAR(5) UNIQUE NOT NULL,
            team_name VARCHAR(100) NOT NULL
        )`);

        await client.query(`CREATE TABLE Players (
            player_id SERIAL PRIMARY KEY,
            player_name VARCHAR(100) NOT NULL,
            position VARCHAR(10),
            ppg NUMERIC(4,1),
            rpg NUMERIC(4,1),
            apg NUMERIC(4,1),
            bpm NUMERIC(4,1),
            ts_percent NUMERIC(4,2) DEFAULT 0.00,
            team_id INTEGER REFERENCES Teams(team_id) ON DELETE CASCADE
        )`);

        await client.query(`CREATE TABLE Trades (
            trade_id SERIAL PRIMARY KEY,
            team_a_id INTEGER REFERENCES Teams(team_id),
            team_b_id INTEGER REFERENCES Teams(team_id),
            trade_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        await client.query(`CREATE TABLE Trade_Details (
    detail_id SERIAL PRIMARY KEY,
    trade_id INTEGER REFERENCES Trades(trade_id) ON DELETE CASCADE,
    player_id INTEGER REFERENCES Players(player_id),
    from_team_id INTEGER REFERENCES Teams(team_id),
    to_team_id INTEGER REFERENCES Teams(team_id)
        )`);

        await client.query("CREATE INDEX idx_players_team_id ON Players(team_id)");
        await client.query("CREATE INDEX idx_players_ppg ON Players(ppg)");

        const teams = [
            ['ATL', 'Hawks'], ['BOS', 'Celtics'], ['BRK', 'Nets'], ['CHO', 'Hornets'], 
            ['CHI', 'Bulls'], ['CLE', 'Cavaliers'], ['DAL', 'Mavericks'], ['DEN', 'Nuggets'], 
            ['DET', 'Pistons'], ['GSW', 'Warriors'], ['HOU', 'Rockets'], ['IND', 'Pacers'], 
            ['LAC', 'Clippers'], ['LAL', 'Lakers'], ['MEM', 'Grizzlies'], ['MIA', 'Heat'], 
            ['MIL', 'Bucks'], ['MIN', 'Timberwolves'], ['NOP', 'Pelicans'], ['NYK', 'Knicks'], 
            ['OKC', 'Thunder'], ['ORL', 'Magic'], ['PHI', '76ers'], ['PHO', 'Suns'], 
            ['POR', 'Trail Blazers'], ['SAC', 'Kings'], ['SAS', 'Spurs'], ['TOR', 'Raptors'], 
            ['UTA', 'Utah Jazz'], ['WAS', 'Wizards'], ['2TM', 'Multi-Team/Traded']
        ];

        for (let t of teams) {
            await client.query("INSERT INTO Teams (team_code, team_name) VALUES ($1, $2)", t);
        }

        await client.query('COMMIT');
        console.log("Postgres initialized and teams seeded.");
    } catch (e) {
        await client.query('ROLLBACK');
        console.error("Init Error:", e);
    } finally {
        client.release();
    }
};

initializeDB();