🛠️ Technical Stack
Backend: Node.js, Express.js

Database: PostgreSQL (Managed via Render)

View Engine: EJS (Embedded JavaScript)

Deployment: GitHub CI/CD to Render

1. SQL Injection Protection
The application utilizes Parameterized Queries (Prepared Statements) for all database interactions. By separating the SQL command from the user-supplied data using placeholders ($1, $2, etc.), the database engine treats input strictly as data, effectively neutralizing SQL injection attacks.

Related Code (index.js):

const query = 'UPDATE Players SET ppg = $1, rpg = $2, apg = $3, bpm = $4 WHERE player_id = $5';
await pool.query(query, [ppg, rpg, apg, bpm, player_id]);

2. Indexing
The appplication has an index on Players(team_id). This is to optimize the Dashboard view on the '/' route, since otherwise you'd have to do a full table scan to load team rosters.

Related code (index.js):

SELECT * FROM Players WHERE team_id = $1

It also has an index on Players(ppg). This is to optimize the scoring filter, so that you can better handle range queries.

Related code (index.js):

...AND ppg >= $2

3. Transactions and Concurrency
Transactions are used especially in the '/execute-trade' route. We start transactions with client.query('BEGIN') as a PostgreSQL transaction block. Then we use UPDATE and INSERT commands. client.query('ROLLBACK') is used in catch blocks so data can be reverted.
This is important cause trades and other updates are compound operations so multiple SQL commands happen in a set order. A transaction is used so if something goes wrong, we can revert using ROLLBACK, rather than leaving a trade in half finished status. This also locks specfic rows. This is single user so concurrency really matters if one person has multiple tabs open, and for the isolation aspect.

For isolation the application uses the default PostgreSQL of read committed. This works for the purposes of the project, since it is single user. Because of this, you don't do dirty reads and see the trade midway through the transaction.
