# NBA Roster Manager - Project Documentation

This project is a web-based NBA Roster Manager that lets you act as a league commissioner. You can browse through all 30 teams, manage their rosters, and handle player movements in real-time.

What you can do:
Manage Rosters: View every player in the league, add new ones, update their stats, or waive them from a team.

The Trade Room: Pick any two teams to trade players. It calculates the total value (PPG and BPM) for both sides so you can see if a trade is "fair" before hitting execute.

Trade History: Every move you make is saved in a history log that shows exactly who was traded, when it happened, and which teams were involved.

It’s Live: Unlike a local project, this is hosted in the cloud. Because it uses a real PostgreSQL database, all your trades and player updates stay saved even if the server restarts or you close your browser.

Hosted link: https://nba-roster-manager.onrender.com/

*note: The application is hosted on Render’s Free Tier, which utilizes a 15-minute inactivity spin-down. This can cause a 30-60 cold start delay on an initial request, which will probably be the case when you visit. Data integrity should still be maintained, since the database is separate from the web service.

## 🛠️ Technical Stack
* **Backend:** Node.js, Express.js
* **Database:** PostgreSQL (Managed via Render)
* **View Engine:** EJS (Embedded JavaScript)
* **Deployment:** GitHub CI/CD to Render

---

## 1. SQL Injection Protection
The application utilizes **Parameterized Queries (Prepared Statements)** for all database interactions. By separating the SQL command from the user-supplied data using placeholders ($1, $2, etc.), the database engine treats input strictly as data, effectively neutralizing SQL injection attacks.

**Related Code (index.js):**
```javascript
const query = 'UPDATE Players SET ppg = $1, rpg = $2, apg = $3, bpm = $4 WHERE player_id = $5';
await pool.query(query, [ppg, rpg, apg, bpm, player_id]);
```

---

## 2. Indexing
The appplication has an index on **Players(team_id)**. This is to optimize the Dashboard view on the '/' route, since otherwise you'd have to do a full table scan to load team rosters.

**Related code (index.js):**
```sql
SELECT * FROM Players WHERE team_id = $1
```

It also has an index on **Players(ppg)**. This is to optimize the scoring filter, so that you can better handle range queries.

**Related code (index.js):**
```sql
...AND ppg >= $2
```

---

## 3. Transactions and Concurrency
**Transactions** are used especially in the '/execute-trade' route. We start transactions with `client.query('BEGIN')` as a PostgreSQL transaction block. Then we use `UPDATE` and `INSERT` commands. `client.query('ROLLBACK')` is used in catch blocks so data can be reverted.

This is important cause trades and other updates are compound operations so multiple SQL commands happen in a set order. A transaction is used so if something goes wrong, we can revert using `ROLLBACK`, rather than leaving a trade in half finished status. This also locks specfic rows. This is single user so concurrency really matters if one person has multiple tabs open, and for the isolation aspect.

For **isolation** the application uses the default PostgreSQL of **read committed**. This works for the purposes of the project, since it is single user. Because of this, you don't do dirty reads and see the trade midway through the transaction.

To make this multi-user I could have made a users table and made it so each person could be the GM of a different team. I could have also have more robust concurrency control and add conflict handling. 

---

## AI USAGE
**Tool Used:** Gemini (Google)

I used the AI to help implement the **Parameterized Queries** from the PostgreSQL documentation to avoid SQL Injection attacks. Instead of going through and manually replacing every instance, I used it to refactor to include placeholders such as $1, $2. I also used AI to create a script to populate seed data for the tables. I had retreived the nba roster as a CSV file from basketballreference.com and used the AI to create a script to populate the tables with that. 

I also used it as a **debugger**. For example, I had an issue with my new feature of trade history not loading correctly. It helped me identify a mismatch of schema between index.js and the new ejs file. Another issue was for trades, there were scenarios where you could create a trade between two of the same team, and it pointed out a few methods to avoid that. I ended up deciding to return an error if that was the case. 

Another method AI was used for was to find out why **sqllite** exactly was not really working out for what I wanted. There was really no persistence. I ended up finding out that with sqllite, hosting on the cloud and its serverless nature meant that every time the server restarted the files would be wiped. I needed more reliable persistence, so it helped me narrow down to PostgreSQL as that choice.

Finally I used AI to check the **robustness** of my project. I asked it if my current features would be prone to any issues. Also, I used AI to help format this README to not just be a blob of text, as markdown formatting was really bothering me!

I verified any code or suggestions generated by this AI by extensively testing them in localhost, as well as referencing documentation (specifically for PostgreSQL), and even reddit threads for similar issues or design choices.

