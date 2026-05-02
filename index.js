const express = require('express');
const pool = require('./db');
const app = express();

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));

// --- ROUTE 1: DASHBOARD 
app.get('/', async (req, res) => {
    const { team_id, position, minPPG, minBPM } = req.query;

    try {
        const teamsResult = await pool.query('SELECT * FROM Teams ORDER BY team_name');
        const allTeams = teamsResult.rows;

        if (!team_id) {
            return res.render('index', { 
                teams: allTeams, players: [], selectedTeamId: null, position: '', minPPG: 0, minBPM: 0 
            });
        }

        let queryText = 'SELECT * FROM Players WHERE team_id = $1';
        let queryParams = [team_id];
        let placeholderCount = 2;

        if (position) { 
            queryText += ` AND position = $${placeholderCount++}`; 
            queryParams.push(position); 
        }
        if (minPPG) { 
            queryText += ` AND ppg >= $${placeholderCount++}`; 
            queryParams.push(minPPG); 
        }
        if (minBPM) { 
            queryText += ` AND bpm >= $${placeholderCount++}`; 
            queryParams.push(minBPM); 
        }

        const playersResult = await pool.query(queryText, queryParams);
        res.render('index', { 
            teams: allTeams, players: playersResult.rows, selectedTeamId: team_id, position, minPPG, minBPM 
        });

    } catch (error) { 
        res.status(500).send("Database Error: " + error.message); 
    }
});

// --- ROUTE 2: TRADE HISTORY 
app.get('/history', async (req, res) => {
    const historyQuery = `
        SELECT 
            t.trade_date,
            p.player_name,
            t1.team_name AS from_team,
            t2.team_name AS to_team
        FROM Trade_Details td
        JOIN Trades t ON td.trade_id = t.trade_id
        JOIN Players p ON td.player_id = p.player_id
        JOIN Teams t1 ON td.from_team_id = t1.team_id
        JOIN Teams t2 ON td.to_team_id = t2.team_id
        ORDER BY t.trade_date DESC
    `;

    try {
        const result = await pool.query(historyQuery);
        res.render('history', { history: result.rows });
    } catch (error) {
        res.status(500).send("Could not load trade history logs.");
    }
});

// --- ROUTE 3: TRADE ROOM UI 
app.get('/trade-room', async (req, res) => {
    const { t1, t2 } = req.query;
    const tradeSelections1 = [].concat(req.query.trade1 || []);
    const tradeSelections2 = [].concat(req.query.trade2 || []);

    try {
        const teamsResult = await pool.query('SELECT * FROM Teams ORDER BY team_name');
        const allTeams = teamsResult.rows;

        if (!t1 || !t2) {
            return res.render('trade-room', { 
                allTeams, r1:[], r2:[], staged1:[], staged2:[], 
                totals1:{ppg:0, bpm:0}, totals2:{ppg:0, bpm:0}, 
                winner:null, t1, t2, trade1: tradeSelections1, trade2: tradeSelections2 
            });
        }

        const playersResult = await pool.query('SELECT * FROM Players WHERE team_id IN ($1, $2)', [t1, t2]);
        const allPlayers = playersResult.rows;
        
        const roster1 = allPlayers.filter(p => p.team_id == t1);
        const roster2 = allPlayers.filter(p => p.team_id == t2);

        const stagedPlayers1 = allPlayers.filter(p => tradeSelections1.includes(p.player_id.toString()));
        const stagedPlayers2 = allPlayers.filter(p => tradeSelections2.includes(p.player_id.toString()));

        function calculateStats(playerList) {
            let ppgSum = 0;
            let bpmSum = 0;
            
            playerList.forEach(player => {
                ppgSum += parseFloat(player.ppg);
                bpmSum += parseFloat(player.bpm);
            });

            return { ppg: ppgSum.toFixed(1), bpm: bpmSum.toFixed(1) };
        }

        const team1Totals = calculateStats(stagedPlayers1);
        const team2Totals = calculateStats(stagedPlayers2);

        let tradeStatus = "Waiting for selections...";
        if (stagedPlayers1.length > 0 && stagedPlayers2.length > 0) {
            if (parseFloat(team1Totals.ppg) > parseFloat(team2Totals.ppg)) {
                tradeStatus = "Team B is gaining more PPG value";
            } else if (parseFloat(team2Totals.ppg) > parseFloat(team1Totals.ppg)) {
                tradeStatus = "Team A is gaining more PPG value";
            } else {
                tradeStatus = "Trade value is balanced";
            }
        }

        res.render('trade-room', { 
            allTeams, r1: roster1, r2: roster2, 
            staged1: stagedPlayers1, staged2: stagedPlayers2, 
            totals1: team1Totals, totals2: team2Totals, 
            winner: tradeStatus, t1, t2, 
            trade1: tradeSelections1, trade2: tradeSelections2 
        });

    } catch (error) { 
        res.status(500).send("Trade Room Error: " + error.message); 
    }
});

// --- ROUTE 4: EXECUTE TRADE 
app.post('/execute-trade', async (req, res) => {
    const teamA = req.body.t1;
    const teamB = req.body.t2;
    const playersFromA = [].concat(req.body.trade1 || []);
    const playersFromB = [].concat(req.body.trade2 || []);

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const headerRes = await client.query(
            'INSERT INTO Trades (team_a_id, team_b_id) VALUES ($1, $2) RETURNING trade_id',
            [teamA, teamB]
        );
        const tradeId = headerRes.rows[0].trade_id;

        for (const pId of playersFromA) {
            await client.query('UPDATE Players SET team_id = $1 WHERE player_id = $2', [teamB, pId]);
            await client.query(
                'INSERT INTO Trade_Details (trade_id, player_id, from_team_id, to_team_id) VALUES ($1, $2, $3, $4)',
                [tradeId, pId, teamA, teamB]
            );
        }

        for (const pId of playersFromB) {
            await client.query('UPDATE Players SET team_id = $1 WHERE player_id = $2', [teamA, pId]);
            await client.query(
                'INSERT INTO Trade_Details (trade_id, player_id, from_team_id, to_team_id) VALUES ($1, $2, $3, $4)',
                [tradeId, pId, teamB, teamA]
            );
        }

        await client.query('COMMIT');
        res.redirect(`/trade-room?t1=${teamA}&t2=${teamB}`);

    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).send("Transaction Error: " + error.message);
    } finally {
        client.release();
    }
});


app.post('/update-stats', async (req, res) => {
    const { player_id, ppg, rpg, apg, bpm, team_id } = req.body;
    try {
        await pool.query(
            'UPDATE Players SET ppg = $1, rpg = $2, apg = $3, bpm = $4 WHERE player_id = $5', 
            [ppg, rpg, apg, bpm, player_id]
        );
        res.redirect(`/?team_id=${team_id}`);
    } catch (err) { res.status(500).send(err.message); }
});

app.post('/delete-player', async (req, res) => {
    const { id, team_id } = req.body;
    try {
        await pool.query('DELETE FROM Players WHERE player_id = $1', [id]);
        res.redirect(`/?team_id=${team_id}`);
    } catch (err) { res.status(500).send(err.message); }
});

app.post('/add-player', async (req, res) => {
    const { name, pos, ppg, rpg, apg, bpm, team_id } = req.body;
    try {
        await pool.query(
            'INSERT INTO Players (player_name, position, ppg, rpg, apg, bpm, ts_percent, team_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', 
            [name, pos, ppg, rpg, apg, bpm, 0.000, team_id]
        );
        res.redirect(`/?team_id=${team_id}`);
    } catch (err) { res.status(500).send(err.message); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`NBA Project server started on http://localhost:${PORT}`));